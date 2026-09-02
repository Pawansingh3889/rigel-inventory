-- Fix critical security issues

-- 1. Enable RLS on current_stock_levels view (recreate as secure view)
DROP VIEW IF EXISTS public.current_stock_levels;

CREATE VIEW public.current_stock_levels 
WITH (security_invoker = true)
AS
SELECT 
    company_id,
    product_id,
    warehouse_id,
    bin_id,
    SUM(quantity_change) as current_stock,
    COUNT(*) as transaction_count,
    MAX(transaction_date) as last_transaction_date
FROM public.inventory_transactions 
GROUP BY company_id, product_id, warehouse_id, bin_id;

-- Enable RLS on the view
ALTER VIEW public.current_stock_levels SET (security_invoker = true);

-- Create RLS policy for current_stock_levels view
-- Note: Views inherit policies from underlying tables when using security_invoker

-- 2. Fix function search_path issues
CREATE OR REPLACE FUNCTION public.generate_transfer_number(comp_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    counter INTEGER;
    transfer_number TEXT;
BEGIN
    -- Get the next transfer counter for this company
    SELECT COALESCE(MAX(CAST(SUBSTRING(st.transfer_number FROM 4) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.stock_transfers st
    WHERE st.company_id = comp_id 
    AND st.transfer_number LIKE 'TRF%';
    
    -- Generate transfer number
    transfer_number := 'TRF' || LPAD(counter::TEXT, 4, '0');
    
    RETURN transfer_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_generate_transfer_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.transfer_number IS NULL OR NEW.transfer_number = '' THEN
        NEW.transfer_number := public.generate_transfer_number(NEW.company_id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_gated_business_ref_no()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    ref_no TEXT;
    date_part TEXT;
    random_part TEXT;
BEGIN
    -- Get current date in YYYYMMDD format
    date_part := to_char(now(), 'YYYYMMDD');

    -- Loop until we find a unique ref against companies.business_ref_no
    LOOP
        random_part := upper(substr(md5(random()::text), 1, 5));
        ref_no := 'BUS-' || date_part || '-' || random_part;

        EXIT WHEN NOT EXISTS (
            SELECT 1
            FROM public.companies
            WHERE business_ref_no = ref_no
        );
    END LOOP;

    RETURN ref_no;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_business_ref()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    new_ref TEXT;
    counter INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(business_ref FROM 5) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.businesses;
    
    new_ref := 'BUS-' || LPAD(counter::TEXT, 6, '0');
    RETURN new_ref;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_user_ref(comp_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    new_ref TEXT;
    comp_ref TEXT;
    counter INTEGER;
BEGIN
    -- Try business_ref_no if present
    SELECT business_ref_no INTO comp_ref FROM public.companies WHERE id = comp_id;

    -- Fallback to first 4 letters of company name
    IF comp_ref IS NULL OR comp_ref = '' THEN
        SELECT 'COMP-' || UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(name,''), '[^A-Za-z]', '', 'g') FROM 1 FOR 4))
        INTO comp_ref FROM public.companies WHERE id = comp_id;
    END IF;

    -- Next user counter for this company - use company_users table
    SELECT COALESCE(MAX(
        CASE 
            WHEN cu.username LIKE comp_ref || '-U%' THEN
                CASE 
                    WHEN SUBSTRING(cu.username FROM LENGTH(comp_ref || '-U') + 1) ~ '^[0-9]+$' THEN
                        CAST(SUBSTRING(cu.username FROM LENGTH(comp_ref || '-U') + 1) AS INTEGER)
                    ELSE 0
                END
            ELSE 0
        END
    ), 0) + 1
    INTO counter
    FROM public.company_users cu
    WHERE cu.company_id = comp_id;

    new_ref := comp_ref || '-U' || LPAD(counter::TEXT, 3, '0');
    RETURN new_ref;
END;
$$;
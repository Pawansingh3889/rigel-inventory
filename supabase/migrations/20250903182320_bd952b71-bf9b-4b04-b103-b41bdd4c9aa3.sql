-- Add missing fields to sales_orders table
ALTER TABLE public.sales_orders 
ADD COLUMN IF NOT EXISTS salesperson_id uuid,
ADD COLUMN IF NOT EXISTS account_manager text,
ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'standard' CHECK (order_type IN ('standard', 'return', 'export', 'sample')),
ADD COLUMN IF NOT EXISTS billing_address_line1 text,
ADD COLUMN IF NOT EXISTS billing_address_line2 text,
ADD COLUMN IF NOT EXISTS billing_city text,
ADD COLUMN IF NOT EXISTS billing_state text,
ADD COLUMN IF NOT EXISTS billing_country text,
ADD COLUMN IF NOT EXISTS billing_pin_code text;

-- Add missing fields to sales_order_items table  
ALTER TABLE public.sales_order_items
ADD COLUMN IF NOT EXISTS line_no integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS net_amount numeric DEFAULT 0;

-- Update SO number generation function to match required format
CREATE OR REPLACE FUNCTION public.generate_so_number(comp_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    company_name TEXT;
    first_four_letters TEXT;
    counter INTEGER;
    so_number TEXT;
BEGIN
    -- Get company name
    SELECT name INTO company_name FROM public.companies WHERE id = comp_id;
    
    -- Extract first 4 letters from company name
    first_four_letters := UPPER(SUBSTRING(REGEXP_REPLACE(company_name, '[^A-Za-z]', '', 'g') FROM 1 FOR 4));
    
    -- Ensure we have at least 4 characters, pad with 'X' if needed
    WHILE LENGTH(first_four_letters) < 4 LOOP
        first_four_letters := first_four_letters || 'X';
    END LOOP;
    
    -- Get the next SO counter starting from 1001
    SELECT COALESCE(MAX(
        CASE 
            WHEN so.order_number LIKE first_four_letters || 'SO%' AND 
                 SUBSTRING(so.order_number FROM LENGTH(first_four_letters || 'SO') + 1) ~ '^[0-9]+$' THEN
                CAST(SUBSTRING(so.order_number FROM LENGTH(first_four_letters || 'SO') + 1) AS INTEGER)
            ELSE 1000
        END
    ), 1000) + 1
    INTO counter
    FROM public.sales_orders so
    WHERE so.company_id = comp_id;
    
    -- Ensure counter starts from 1001 minimum
    IF counter < 1001 THEN
        counter := 1001;
    END IF;
    
    -- Generate SO number: First4LettersSO + Counter starting from 1001
    so_number := first_four_letters || 'SO' || counter::TEXT;
    
    RETURN so_number;
END;
$$;
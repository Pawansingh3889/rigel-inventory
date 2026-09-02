-- Create return_order_header table
CREATE TABLE public.return_order_header (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  rso_number TEXT,
  rso_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  invoice_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  reason_for_credit TEXT NOT NULL CHECK (reason_for_credit IN ('Return', 'Price Correction', 'Discount', 'Others')),
  delivery_same_as_company BOOLEAN NOT NULL DEFAULT true,
  delivery_address_line1 TEXT,
  delivery_address_line2 TEXT,
  delivery_city TEXT,
  delivery_country TEXT,
  delivery_pin_code TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Confirmed')),
  subtotal_amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create return_order_lines table
CREATE TABLE public.return_order_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_order_id UUID NOT NULL REFERENCES public.return_order_header(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  hsn_sac_code TEXT,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  invoice_qty INTEGER NOT NULL,
  return_qty INTEGER NOT NULL DEFAULT 0,
  pending_return_qty INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_percentage NUMERIC DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  cgst_rate NUMERIC DEFAULT 0,
  cgst_amount NUMERIC DEFAULT 0,
  sgst_rate NUMERIC DEFAULT 0,
  sgst_amount NUMERIC DEFAULT 0,
  igst_rate NUMERIC DEFAULT 0,
  igst_amount NUMERIC DEFAULT 0,
  line_subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create function to generate RSO number
CREATE OR REPLACE FUNCTION public.generate_rso_number(p_customer_id UUID, p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    customer_name TEXT;
    first_four_letters TEXT;
    counter INTEGER;
    rso_number TEXT;
BEGIN
    -- Get customer name
    SELECT name INTO customer_name FROM public.customers WHERE id = p_customer_id;
    
    -- Extract first 4 letters from customer name
    first_four_letters := UPPER(SUBSTRING(REGEXP_REPLACE(customer_name, '[^A-Za-z]', '', 'g') FROM 1 FOR 4));
    
    -- Ensure we have at least 4 characters, pad with 'X' if needed
    WHILE LENGTH(first_four_letters) < 4 LOOP
        first_four_letters := first_four_letters || 'X';
    END LOOP;
    
    -- Get the next RSO counter starting from 1001
    SELECT COALESCE(MAX(
        CASE 
            WHEN roh.rso_number LIKE first_four_letters || 'RSO%' AND 
                 SUBSTRING(roh.rso_number FROM LENGTH(first_four_letters || 'RSO') + 1) ~ '^[0-9]+$' THEN
                CAST(SUBSTRING(roh.rso_number FROM LENGTH(first_four_letters || 'RSO') + 1) AS INTEGER)
            ELSE 1000
        END
    ), 1000) + 1
    INTO counter
    FROM public.return_order_header roh
    WHERE roh.company_id = p_company_id;
    
    -- Ensure counter starts from 1001 minimum
    IF counter < 1001 THEN
        counter := 1001;
    END IF;
    
    -- Generate RSO number: First4LettersRSO + Counter starting from 1001
    rso_number := first_four_letters || 'RSO' || counter::TEXT;
    
    RETURN rso_number;
END;
$$;

-- Create function to auto-generate RSO number on insert
CREATE OR REPLACE FUNCTION public.auto_generate_rso_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.rso_number IS NULL OR NEW.rso_number = '' THEN
        NEW.rso_number := public.generate_rso_number(NEW.customer_id, NEW.company_id);
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger for auto-generation of RSO number
CREATE TRIGGER trigger_auto_generate_rso_number
    BEFORE INSERT ON public.return_order_header
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_rso_number();

-- Add sales_return to transaction_type enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
        -- Create the enum if it doesn't exist (fallback)
        CREATE TYPE transaction_type AS ENUM ('purchase_receipt', 'sales_invoice', 'adjustment', 'transfer_out', 'transfer_in', 'sales_return');
    ELSE
        -- Add sales_return to existing enum
        ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'sales_return';
    END IF;
END$$;

-- Enable Row Level Security
ALTER TABLE public.return_order_header ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_order_lines ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Company isolation for return_order_header" 
ON public.return_order_header 
FOR ALL 
USING (company_id = user_company_id());

CREATE POLICY "Return order lines access" 
ON public.return_order_lines 
FOR ALL 
USING (return_order_id IN (
    SELECT id FROM public.return_order_header WHERE company_id = user_company_id()
));

-- Create updated_at trigger
CREATE TRIGGER set_updated_at_return_order_header
    BEFORE UPDATE ON public.return_order_header
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();
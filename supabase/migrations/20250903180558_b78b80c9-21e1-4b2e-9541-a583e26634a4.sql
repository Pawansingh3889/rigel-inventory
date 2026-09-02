-- Add missing fields for customer form update
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS credit_limit_days integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS preferred_payment_method text DEFAULT 'Bank Transfer',
ADD COLUMN IF NOT EXISTS gst_tax_location text;

-- Update customer_ref generation function to match new format
CREATE OR REPLACE FUNCTION public.generate_customer_id(customer_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    first_four_letters TEXT;
    counter INTEGER;
    customer_id TEXT;
BEGIN
    -- Extract first 4 letters from customer name
    first_four_letters := UPPER(SUBSTRING(REGEXP_REPLACE(customer_name, '[^A-Za-z]', '', 'g') FROM 1 FOR 4));
    
    -- Ensure we have at least 4 characters, pad with 'X' if needed
    WHILE LENGTH(first_four_letters) < 4 LOOP
        first_four_letters := first_four_letters || 'X';
    END LOOP;
    
    -- Get the next counter starting from 1001
    SELECT COALESCE(MAX(
        CASE 
            WHEN c.customer_ref LIKE first_four_letters || '%' AND 
                 SUBSTRING(c.customer_ref FROM LENGTH(first_four_letters) + 1) ~ '^[0-9]+$' THEN
                CAST(SUBSTRING(c.customer_ref FROM LENGTH(first_four_letters) + 1) AS INTEGER)
            ELSE 1000
        END
    ), 1000) + 1
    INTO counter
    FROM public.customers c;
    
    -- Ensure counter starts from 1001 minimum
    IF counter < 1001 THEN
        counter := 1001;
    END IF;
    
    -- Generate customer ID: First4Letters + Counter
    customer_id := first_four_letters || counter::TEXT;
    
    RETURN customer_id;
END;
$$;

-- Update the trigger function for customer_ref generation
CREATE OR REPLACE FUNCTION public.auto_generate_customer_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.customer_ref IS NULL OR NEW.customer_ref = '' THEN
        NEW.customer_ref := generate_customer_id(NEW.name);
    END IF;
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS auto_generate_customer_ref_trigger ON public.customers;
CREATE TRIGGER auto_generate_customer_id_trigger
    BEFORE INSERT ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_customer_id();
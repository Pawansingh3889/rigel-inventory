-- Add new fields to customers table
ALTER TABLE public.customers 
ADD COLUMN customer_ref text,
ADD COLUMN customer_type text CHECK (customer_type IN ('individual', 'business', 'government', 'msme')),
ADD COLUMN address_line1 text,
ADD COLUMN address_line2 text,
ADD COLUMN city text,
ADD COLUMN state text,
ADD COLUMN pin_code text,
ADD COLUMN country text,
ADD COLUMN alternate_email text,
ADD COLUMN landline_number text,
ADD COLUMN website text,
ADD COLUMN gstin text,
ADD COLUMN pan_number text,
ADD COLUMN msme_registration_no text,
ADD COLUMN business_registration_no text,
ADD COLUMN same_as_registered_address boolean DEFAULT false,
ADD COLUMN shipping_address_line1 text,
ADD COLUMN shipping_address_line2 text,
ADD COLUMN shipping_city text,
ADD COLUMN shipping_state text,
ADD COLUMN shipping_pin_code text,
ADD COLUMN shipping_country text,
ADD COLUMN payment_terms text,
ADD COLUMN preferred_currency text DEFAULT 'INR',
ADD COLUMN billing_cycle text,
ADD COLUMN bank_name text,
ADD COLUMN branch_name text,
ADD COLUMN account_number text,
ADD COLUMN account_type text,
ADD COLUMN ifsc_code text,
ADD COLUMN swift_code text,
ADD COLUMN upi_id text;

-- Create function to generate customer reference
CREATE OR REPLACE FUNCTION public.generate_customer_ref(customer_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    first_four_letters TEXT;
    current_month TEXT;
    current_year TEXT;
    ref_no TEXT;
    counter INTEGER := 1;
    final_ref TEXT;
BEGIN
    -- Extract first 4 letters from customer name
    first_four_letters := UPPER(SUBSTRING(REGEXP_REPLACE(customer_name, '[^A-Za-z]', '', 'g') FROM 1 FOR 4));
    
    -- Ensure we have at least 4 characters, pad with 'X' if needed
    WHILE LENGTH(first_four_letters) < 4 LOOP
        first_four_letters := first_four_letters || 'X';
    END LOOP;
    
    -- Get current month and year
    current_month := LPAD(EXTRACT(MONTH FROM NOW())::TEXT, 2, '0');
    current_year := EXTRACT(YEAR FROM NOW())::TEXT;
    
    -- Generate base reference number
    ref_no := first_four_letters || '-' || current_month || current_year;
    final_ref := ref_no;
    
    -- Check for uniqueness and add counter if needed
    WHILE EXISTS (SELECT 1 FROM public.customers WHERE customer_ref = final_ref) LOOP
        final_ref := ref_no || '-' || LPAD(counter::TEXT, 3, '0');
        counter := counter + 1;
    END LOOP;
    
    RETURN final_ref;
END;
$function$;

-- Create trigger to auto-generate customer reference
CREATE OR REPLACE FUNCTION public.auto_generate_customer_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.customer_ref IS NULL OR NEW.customer_ref = '' THEN
        NEW.customer_ref := generate_customer_ref(NEW.name);
    END IF;
    RETURN NEW;
END;
$function$;

-- Create trigger for customers table
CREATE TRIGGER customers_auto_generate_ref
    BEFORE INSERT ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_customer_ref();
-- Add missing fields to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS supplier_type text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS preferred_currency text DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS payment_terms text,
ADD COLUMN IF NOT EXISTS branch_name text,
ADD COLUMN IF NOT EXISTS swift_code text,
ADD COLUMN IF NOT EXISTS tax_id text,
ADD COLUMN IF NOT EXISTS business_registration_no text;

-- Drop and recreate the supplier_ref generation function with DDMMYYYY format
DROP FUNCTION IF EXISTS public.generate_supplier_ref(text);

CREATE OR REPLACE FUNCTION public.generate_supplier_ref(supplier_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    first_four_letters TEXT;
    date_part TEXT;
    ref_no TEXT;
    counter INTEGER := 1;
    final_ref TEXT;
BEGIN
    -- Extract first 4 letters from supplier name
    first_four_letters := UPPER(SUBSTRING(REGEXP_REPLACE(supplier_name, '[^A-Za-z]', '', 'g') FROM 1 FOR 4));
    
    -- Ensure we have at least 4 characters, pad with 'X' if needed
    WHILE LENGTH(first_four_letters) < 4 LOOP
        first_four_letters := first_four_letters || 'X';
    END LOOP;
    
    -- Get current date in DDMMYYYY format
    date_part := to_char(NOW(), 'DDMMYYYY');
    
    -- Generate base reference number
    ref_no := first_four_letters || date_part;
    final_ref := ref_no;
    
    -- Check for uniqueness and add counter if needed
    WHILE EXISTS (SELECT 1 FROM public.suppliers WHERE supplier_ref = final_ref) LOOP
        final_ref := ref_no || '-' || LPAD(counter::TEXT, 2, '0');
        counter := counter + 1;
    END LOOP;
    
    RETURN final_ref;
END;
$function$;
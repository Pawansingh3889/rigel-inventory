-- Add supplier reference number field to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN supplier_ref TEXT;

-- Create function to generate supplier reference number
CREATE OR REPLACE FUNCTION public.generate_supplier_ref(company_name text)
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
    -- Extract first 4 letters from company name
    first_four_letters := UPPER(SUBSTRING(REGEXP_REPLACE(company_name, '[^A-Za-z]', '', 'g') FROM 1 FOR 4));
    
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
    WHILE EXISTS (SELECT 1 FROM public.suppliers WHERE supplier_ref = final_ref) LOOP
        final_ref := ref_no || '-' || LPAD(counter::TEXT, 3, '0');
        counter := counter + 1;
    END LOOP;
    
    RETURN final_ref;
END;
$function$

-- Create trigger to auto-generate supplier reference
CREATE OR REPLACE FUNCTION public.auto_generate_supplier_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.supplier_ref IS NULL OR NEW.supplier_ref = '' THEN
        NEW.supplier_ref := generate_supplier_ref(NEW.name);
    END IF;
    RETURN NEW;
END;
$function$

-- Create trigger for supplier reference generation
CREATE TRIGGER auto_generate_supplier_ref_trigger
    BEFORE INSERT ON public.suppliers
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_supplier_ref();

-- Add unique constraint for supplier reference
ALTER TABLE public.suppliers 
ADD CONSTRAINT suppliers_supplier_ref_unique UNIQUE (supplier_ref);
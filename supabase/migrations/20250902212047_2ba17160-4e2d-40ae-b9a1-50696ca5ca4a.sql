-- Fix the last two functions missing search_path

-- Fix auto_generate_gated_business_ref function
CREATE OR REPLACE FUNCTION public.auto_generate_gated_business_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    IF NEW.business_ref_no IS NULL OR NEW.business_ref_no = '' THEN
        NEW.business_ref_no := generate_gated_business_ref_no();
    END IF;
    RETURN NEW;
END;
$function$;

-- Fix generate_business_ref_no function
CREATE OR REPLACE FUNCTION public.generate_business_ref_no(company_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    first_four_letters TEXT;
    current_month TEXT;
    current_year TEXT;
    ref_no TEXT;
BEGIN
    -- Extract first 4 letters from company name
    first_four_letters := UPPER(SUBSTRING(REGEXP_REPLACE(company_name, '[^A-Za-z]', '', 'g') FROM 1 FOR 4));
    
    -- Get current month and year
    current_month := LPAD(EXTRACT(MONTH FROM NOW())::TEXT, 2, '0');
    current_year := EXTRACT(YEAR FROM NOW())::TEXT;
    
    -- Generate reference number
    ref_no := 'PRISM-' || first_four_letters || '-' || current_month || '-' || current_year;
    
    RETURN ref_no;
END;
$function$;
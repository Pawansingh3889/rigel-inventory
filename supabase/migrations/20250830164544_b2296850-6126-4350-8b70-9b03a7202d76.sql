-- Update business_users table to use company_id instead of business_id
ALTER TABLE public.business_users 
DROP COLUMN IF EXISTS business_id,
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Update the generate_user_ref function to work with companies table
CREATE OR REPLACE FUNCTION public.generate_user_ref(comp_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    new_ref TEXT;
    comp_ref TEXT;
    counter INTEGER;
BEGIN
    -- Get company business_ref_no from companies table
    SELECT business_ref_no INTO comp_ref FROM companies WHERE id = comp_id;
    
    -- If no business_ref_no exists, generate a simple one based on company name
    IF comp_ref IS NULL OR comp_ref = '' THEN
        SELECT 'COMP-' || UPPER(SUBSTRING(REGEXP_REPLACE(name, '[^A-Za-z]', '', 'g') FROM 1 FOR 4)) 
        INTO comp_ref FROM companies WHERE id = comp_id;
    END IF;
    
    -- Get the next user counter for this company
    SELECT COALESCE(MAX(CAST(SUBSTRING(bu.user_ref FROM LENGTH(comp_ref || '-U') + 1) AS INTEGER)), 0) + 1
    INTO counter
    FROM business_users bu
    WHERE bu.company_id = comp_id;
    
    -- Generate user reference
    new_ref := comp_ref || '-U' || LPAD(counter::TEXT, 3, '0');
    RETURN new_ref;
END;
$function$;

-- Update the auto_generate_user_ref trigger function
CREATE OR REPLACE FUNCTION public.auto_generate_user_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.user_ref IS NULL OR NEW.user_ref = '' THEN
        NEW.user_ref := generate_user_ref(NEW.company_id);
    END IF;
    RETURN NEW;
END;
$function$;
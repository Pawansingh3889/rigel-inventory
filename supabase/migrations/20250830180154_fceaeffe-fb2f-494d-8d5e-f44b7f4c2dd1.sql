-- Fix the generate_user_ref function to handle inconsistent patterns
CREATE OR REPLACE FUNCTION public.generate_user_ref(comp_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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

    -- Next user counter for this company - only look at user_refs that match the current pattern
    SELECT COALESCE(MAX(
        CASE 
            WHEN bu.user_ref LIKE comp_ref || '-U%' THEN
                CASE 
                    WHEN SUBSTRING(bu.user_ref FROM LENGTH(comp_ref || '-U') + 1) ~ '^[0-9]+$' THEN
                        CAST(SUBSTRING(bu.user_ref FROM LENGTH(comp_ref || '-U') + 1) AS INTEGER)
                    ELSE 0
                END
            ELSE 0
        END
    ), 0) + 1
    INTO counter
    FROM public.business_users bu
    WHERE bu.company_id = comp_id;

    new_ref := comp_ref || '-U' || LPAD(counter::TEXT, 3, '0');
    RETURN new_ref;
END;
$function$;
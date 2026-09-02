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
$function$;
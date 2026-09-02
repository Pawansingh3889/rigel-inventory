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
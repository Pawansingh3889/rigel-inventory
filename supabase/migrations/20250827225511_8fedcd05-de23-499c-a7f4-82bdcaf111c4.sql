-- Create trigger for supplier reference generation
CREATE TRIGGER auto_generate_supplier_ref_trigger
    BEFORE INSERT ON public.suppliers
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_supplier_ref();
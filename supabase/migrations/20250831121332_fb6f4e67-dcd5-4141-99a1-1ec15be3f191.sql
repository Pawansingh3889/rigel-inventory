-- Add AFTER INSERT trigger for grn_header to handle inventory updates
CREATE TRIGGER grn_inventory_updates_insert
    AFTER INSERT ON public.grn_header
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_grn_inventory_updates();
-- Ensure triggers for GRN numbering and inventory updates
DROP TRIGGER IF EXISTS trg_auto_generate_grn_number ON public.grn_header;
DROP TRIGGER IF EXISTS trg_handle_grn_inventory ON public.grn_header;

-- Auto-generate GRN number before insert
CREATE TRIGGER trg_auto_generate_grn_number
BEFORE INSERT ON public.grn_header
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_grn_number();

-- Update inventory and PO when GRN status becomes accepted
CREATE TRIGGER trg_handle_grn_inventory
AFTER INSERT OR UPDATE ON public.grn_header
FOR EACH ROW
EXECUTE FUNCTION public.handle_grn_inventory_updates();
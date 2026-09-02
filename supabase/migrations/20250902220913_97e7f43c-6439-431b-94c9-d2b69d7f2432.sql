-- Fix GRN inventory processing triggers and ensure correct behavior
-- 1) Remove any misconfigured triggers that call trg_process_grn_inventory on grn_header
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN 
    SELECT tg.tgname, c.relname
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_proc p ON p.oid = tg.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE NOT tg.tgisinternal
      AND n.nspname = 'public'
      AND p.proname = 'trg_process_grn_inventory'
      AND c.relname = 'grn_header'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.tgname, r.relname);
  END LOOP;
END $$;

-- 2) Create auto-generate GRN number trigger on grn_header (idempotent)
DROP TRIGGER IF EXISTS bi_grn_header_auto_number ON public.grn_header;
CREATE TRIGGER bi_grn_header_auto_number
BEFORE INSERT ON public.grn_header
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_grn_number();

-- 3) Process inventory when GRN status becomes accepted/received (after insert or status update)
DROP TRIGGER IF EXISTS au_grn_header_process_inventory ON public.grn_header;
CREATE TRIGGER au_grn_header_process_inventory
AFTER INSERT OR UPDATE OF status ON public.grn_header
FOR EACH ROW
EXECUTE FUNCTION public.trg_process_grn_inventory_enhanced();

-- 4) Keep the simpler per-line-item trigger on grn_line_items to reconcile on line changes
DROP TRIGGER IF EXISTS aud_grn_line_items_process ON public.grn_line_items;
CREATE TRIGGER aud_grn_line_items_process
AFTER INSERT OR UPDATE OR DELETE ON public.grn_line_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_process_grn_inventory();

-- 5) Maintain updated_at columns
DROP TRIGGER IF EXISTS bu_grn_header_updated_at ON public.grn_header;
CREATE TRIGGER bu_grn_header_updated_at
BEFORE UPDATE ON public.grn_header
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS bu_grn_line_items_updated_at ON public.grn_line_items;
CREATE TRIGGER bu_grn_line_items_updated_at
BEFORE UPDATE ON public.grn_line_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
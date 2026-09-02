-- 1) Wrapper trigger to call process_grn_inventory safely and idempotently
CREATE OR REPLACE FUNCTION public.trg_process_grn_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call the idempotent reconciler which handles delta computations
  PERFORM public.process_grn_inventory(COALESCE(NEW.id, OLD.id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2) Ensure clean slate: drop triggers if they already exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'grn_header' AND t.tgname = 'trg_grn_header_process_inventory'
  ) THEN
    DROP TRIGGER trg_grn_header_process_inventory ON public.grn_header;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'grn_line_items' AND t.tgname = 'trg_grn_line_items_process_inventory'
  ) THEN
    DROP TRIGGER trg_grn_line_items_process_inventory ON public.grn_line_items;
  END IF;
END $$;

-- 3) Create triggers to (re)process inventory any time headers or line items change
CREATE TRIGGER trg_grn_header_process_inventory
AFTER INSERT OR UPDATE ON public.grn_header
FOR EACH ROW
EXECUTE FUNCTION public.trg_process_grn_inventory();

CREATE TRIGGER trg_grn_line_items_process_inventory
AFTER INSERT OR UPDATE OR DELETE ON public.grn_line_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_process_grn_inventory();

-- 4) Retroactively process all relevant GRNs (idempotent)
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Process the specific GRN mentioned by user first (if present)
  FOR r IN 
    SELECT id FROM public.grn_header 
    WHERE grn_number = 'RIGEGRN09022025005'
  LOOP
    PERFORM public.process_grn_inventory(r.id);
  END LOOP;

  -- Process all accepted/received/partially_received GRNs to backfill inventory + PO status
  FOR r IN 
    SELECT id FROM public.grn_header 
    WHERE status IN ('accepted','received','partially_received')
  LOOP
    PERFORM public.process_grn_inventory(r.id);
  END LOOP;
END $$;

-- 1) Fix the line-items trigger function to pass the correct header id
CREATE OR REPLACE FUNCTION public.trg_process_grn_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Use the GRN header id from the line item row (not the line item id)
  PERFORM public.process_grn_inventory(COALESCE(NEW.grn_header_id, OLD.grn_header_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2) Ensure the grn_line_items trigger calls the corrected function on INSERT/UPDATE/DELETE
DROP TRIGGER IF EXISTS trg_grn_line_items_process_inventory ON public.grn_line_items;
CREATE TRIGGER trg_grn_line_items_process_inventory
  AFTER INSERT OR UPDATE OR DELETE ON public.grn_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_process_grn_inventory();

-- 3) Add a unique index to prevent duplicate postings for the same GRN/product/type
-- This protects against multiple triggers or retries creating duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_tx_unique_ref
  ON public.inventory_transactions (company_id, reference_id, product_id, transaction_type);

-- 4) Reprocess any accepted/received GRNs in the last 30 days that have no purchase_receipt transactions yet
-- This will backfill missing inventory transactions safely (the processor is idempotent).
SELECT public.process_grn_inventory_enhanced(gh.id)
FROM public.grn_header gh
LEFT JOIN LATERAL (
  SELECT 1
  FROM public.inventory_transactions it
  WHERE it.reference_id = gh.id
    AND it.transaction_type = 'purchase_receipt'
  LIMIT 1
) t ON TRUE
WHERE t IS NULL
  AND gh.status IN ('accepted','received','partially_received')
  AND gh.created_at > now() - interval '30 days';

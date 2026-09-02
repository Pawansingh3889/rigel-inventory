
-- 1) Safety: ensure the unique constraint/index exists (matches the error)
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_tx_unique_ref
ON public.inventory_transactions (company_id, reference_id, product_id, transaction_type);

-- 2) Make record_inventory_transaction idempotent via UPSERT
CREATE OR REPLACE FUNCTION public.record_inventory_transaction(
  p_company_id uuid,
  p_transaction_type transaction_type,
  p_reference_id uuid,
  p_reference_number text,
  p_product_id uuid,
  p_warehouse_id uuid,
  p_bin_id uuid,
  p_quantity_change integer,
  p_unit_cost numeric DEFAULT 0,
  p_notes text DEFAULT NULL::text,
  p_created_by uuid DEFAULT NULL::uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  transaction_id UUID;
  calculated_total_value NUMERIC;
  effective_created_by UUID;
BEGIN
  -- Total value for this delta
  calculated_total_value := COALESCE(p_quantity_change, 0) * COALESCE(p_unit_cost, 0);

  -- Created by: provided -> auth.uid() -> fallback to first profile in company
  effective_created_by := COALESCE(p_created_by, auth.uid());
  IF effective_created_by IS NULL THEN
    SELECT user_id INTO effective_created_by
    FROM public.profiles
    WHERE company_id = p_company_id
    LIMIT 1;
  END IF;

  -- Insert or update existing transaction for the same (company, reference, product, type)
  INSERT INTO public.inventory_transactions (
    company_id,
    transaction_type,
    reference_id,
    reference_number,
    product_id,
    warehouse_id,
    bin_id,
    quantity_change,
    unit_cost,
    total_value,
    notes,
    created_by
  ) VALUES (
    p_company_id,
    p_transaction_type,
    p_reference_id,
    p_reference_number,
    p_product_id,
    p_warehouse_id,
    p_bin_id,
    COALESCE(p_quantity_change, 0),
    COALESCE(p_unit_cost, 0),
    COALESCE(calculated_total_value, 0),
    p_notes,
    effective_created_by
  )
  ON CONFLICT ON CONSTRAINT uq_inventory_tx_unique_ref
  DO UPDATE
    SET
      quantity_change = public.inventory_transactions.quantity_change + EXCLUDED.quantity_change,
      total_value     = public.inventory_transactions.total_value + EXCLUDED.total_value,
      -- keep a reasonable unit_cost (weighted average when possible)
      unit_cost       = CASE
                          WHEN NULLIF(public.inventory_transactions.quantity_change + EXCLUDED.quantity_change, 0) IS NULL
                            THEN EXCLUDED.unit_cost
                          ELSE
                            (public.inventory_transactions.total_value + EXCLUDED.total_value)
                            / NULLIF(public.inventory_transactions.quantity_change + EXCLUDED.quantity_change, 0)
                        END,
      notes           = COALESCE(EXCLUDED.notes, public.inventory_transactions.notes),
      updated_at      = now()
  RETURNING id INTO transaction_id;

  RETURN transaction_id;
END;
$function$;

-- 3) Ensure GRN processing triggers exist (safe creation)
DO $$
BEGIN
  -- Trigger on grn_line_items to reconcile inventory by delta
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grn_line_items_inventory'
  ) THEN
    CREATE TRIGGER trg_grn_line_items_inventory
    AFTER INSERT OR UPDATE OR DELETE ON public.grn_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_process_grn_inventory();
  END IF;

  -- Trigger on grn_header to process status-aware inventory logic
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grn_header_inventory'
  ) THEN
    CREATE TRIGGER trg_grn_header_inventory
    AFTER INSERT OR UPDATE ON public.grn_header
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_process_grn_inventory_enhanced();
  END IF;
END $$;

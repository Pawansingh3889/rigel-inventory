-- Fix: replace process_grn_inventory without referencing non-existent updated_at on purchase_order_items
CREATE OR REPLACE FUNCTION public.process_grn_inventory(p_grn_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  hdr RECORD;
  li RECORD;
  already_processed_qty INTEGER;
  delta_qty INTEGER;
  total_pending INTEGER;
  new_status TEXT;
BEGIN
  -- Load header; exit if not found
  SELECT * INTO hdr FROM public.grn_header WHERE id = p_grn_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Only process when GRN is in a received/accepted state
  IF hdr.status NOT IN ('accepted','received','partially_received') THEN
    RETURN;
  END IF;

  -- For each line item, compute delta between accepted and already processed inventory qty
  FOR li IN 
    SELECT * FROM public.grn_line_items WHERE grn_header_id = p_grn_id
  LOOP
    SELECT COALESCE(SUM(it.quantity_change), 0)
      INTO already_processed_qty
    FROM public.inventory_transactions it
    WHERE it.transaction_type = 'purchase_receipt'
      AND it.reference_id = p_grn_id
      AND it.product_id = li.product_id;

    delta_qty := COALESCE(li.accepted_quantity, 0) - COALESCE(already_processed_qty, 0);

    -- If there is any delta (positive or negative), reconcile inventory and PO item quantities
    IF delta_qty <> 0 THEN
      -- Update product stock
      UPDATE public.products 
      SET stock_quantity = stock_quantity + delta_qty,
          updated_at = now()
      WHERE id = li.product_id;

      -- Update related PO item received/pending using the delta
      UPDATE public.purchase_order_items poi
      SET received_quantity = GREATEST(0, received_quantity + delta_qty),
          pending_quantity = GREATEST(0, quantity - (received_quantity + delta_qty))
      WHERE poi.purchase_order_id = hdr.purchase_order_id
        AND poi.product_id = li.product_id;

      -- Record the inventory transaction for the delta
      PERFORM public.record_inventory_transaction(
        hdr.company_id,
        'purchase_receipt'::transaction_type,
        hdr.id,
        hdr.grn_number,
        li.product_id,
        li.warehouse_id,
        li.bin_id,
        delta_qty,
        li.unit_price,
        'GRN Receipt - ' || hdr.grn_number,
        NULL -- created_by (use auth.uid())
      );
    END IF;
  END LOOP;

  -- Recompute PO status after adjustments
  SELECT COALESCE(SUM(pending_quantity), 0)
    INTO total_pending
  FROM public.purchase_order_items 
  WHERE purchase_order_id = hdr.purchase_order_id;

  IF total_pending = 0 THEN
    new_status := 'closed';
  ELSIF EXISTS (
    SELECT 1 FROM public.purchase_order_items 
    WHERE purchase_order_id = hdr.purchase_order_id AND received_quantity > 0
  ) THEN
    new_status := 'partially_received';
  ELSE
    new_status := 'open';
  END IF;

  UPDATE public.purchase_orders 
  SET status = new_status,
      updated_at = now()
  WHERE id = hdr.purchase_order_id;

END;
$$;

-- Re-run reconciliation to cover any existing GRNs
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN 
    SELECT id FROM public.grn_header 
    WHERE status IN ('accepted','received','partially_received')
  LOOP
    PERFORM public.process_grn_inventory(r.id);
  END LOOP;
END;
$$;
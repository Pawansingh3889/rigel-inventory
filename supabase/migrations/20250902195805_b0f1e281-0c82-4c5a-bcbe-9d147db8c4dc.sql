-- Retroactively create missing inventory transactions for GRN RIGEGRN09022025001 without altering stock
DO $$
DECLARE
  grn_rec RECORD;
  item_rec RECORD;
  existing_tx_id uuid;
BEGIN
  SELECT * INTO grn_rec FROM public.grn_header WHERE grn_number = 'RIGEGRN09022025001';
  IF grn_rec.id IS NULL THEN
    RAISE NOTICE 'GRN not found';
    RETURN;
  END IF;

  FOR item_rec IN 
    SELECT * FROM public.grn_line_items 
    WHERE grn_header_id = grn_rec.id AND accepted_quantity > 0
  LOOP
    -- Skip if a transaction already exists for this product + GRN
    SELECT id INTO existing_tx_id
    FROM public.inventory_transactions
    WHERE reference_id = grn_rec.id
      AND product_id = item_rec.product_id
      AND transaction_type = 'purchase_receipt'::transaction_type
    LIMIT 1;

    IF existing_tx_id IS NULL THEN
      PERFORM public.record_inventory_transaction(
        grn_rec.company_id,
        'purchase_receipt'::transaction_type,
        grn_rec.id,
        grn_rec.grn_number,
        item_rec.product_id,
        item_rec.warehouse_id,
        item_rec.bin_id,
        item_rec.accepted_quantity,
        item_rec.unit_price,
        'GRN Receipt - ' || grn_rec.grn_number,
        NULL
      );
    END IF;
  END LOOP;
END $$;
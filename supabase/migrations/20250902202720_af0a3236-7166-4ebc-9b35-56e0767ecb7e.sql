
-- 1) Make GRN processing idempotent and safe to re-run
CREATE OR REPLACE FUNCTION public.handle_grn_inventory_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    item_record RECORD;
    grn_header_record RECORD;
    pending_qty_before INTEGER;
    total_pending_qty INTEGER := 0;
BEGIN
    -- Only process when GRN indicates a receipt state
    IF NEW.status NOT IN ('accepted', 'received', 'partially_received') THEN
        RETURN NEW;
    END IF;

    grn_header_record := NEW;

    -- Process each accepted item; skip if already processed (idempotent)
    FOR item_record IN 
        SELECT * 
        FROM public.grn_line_items 
        WHERE grn_header_id = NEW.id 
          AND accepted_quantity > 0
    LOOP
        -- If we already recorded a purchase_receipt for this GRN+product, skip
        IF EXISTS (
            SELECT 1 
            FROM public.inventory_transactions 
            WHERE reference_id = NEW.id 
              AND product_id = item_record.product_id
              AND transaction_type = 'purchase_receipt'
        ) THEN
            CONTINUE;
        END IF;

        -- Validate pending quantity
        SELECT pending_quantity
        INTO pending_qty_before
        FROM public.purchase_order_items 
        WHERE purchase_order_id = grn_header_record.purchase_order_id 
          AND product_id = item_record.product_id;

        IF pending_qty_before IS NULL THEN
            pending_qty_before := 0;
        END IF;

        IF item_record.accepted_quantity > pending_qty_before THEN
            RAISE EXCEPTION 'Accepted quantity (%) exceeds available pending quantity (%) for product %', 
                item_record.accepted_quantity, pending_qty_before, item_record.product_name;
        END IF;

        -- Update product stock
        UPDATE public.products 
        SET stock_quantity = stock_quantity + item_record.accepted_quantity,
            updated_at = now()
        WHERE id = item_record.product_id;

        -- Record inventory transaction (created_by resolved inside function)
        PERFORM public.record_inventory_transaction(
            grn_header_record.company_id,
            'purchase_receipt'::transaction_type,
            NEW.id,
            grn_header_record.grn_number,
            item_record.product_id,
            item_record.warehouse_id,
            item_record.bin_id,
            item_record.accepted_quantity,
            item_record.unit_price,
            'GRN Receipt - ' || grn_header_record.grn_number,
            NULL
        );

        -- Update PO line items
        UPDATE public.purchase_order_items 
        SET received_quantity = received_quantity + item_record.accepted_quantity,
            pending_quantity = GREATEST(0, quantity - (received_quantity + item_record.accepted_quantity)),
            updated_at = now()
        WHERE purchase_order_id = grn_header_record.purchase_order_id 
          AND product_id = item_record.product_id;
    END LOOP;

    -- Recompute and update PO header status
    SELECT COALESCE(SUM(pending_quantity), 0) INTO total_pending_qty
    FROM public.purchase_order_items 
    WHERE purchase_order_id = grn_header_record.purchase_order_id;

    UPDATE public.purchase_orders 
    SET status = CASE 
        WHEN total_pending_qty = 0 THEN 'closed'
        WHEN EXISTS (
            SELECT 1 FROM public.purchase_order_items 
            WHERE purchase_order_id = grn_header_record.purchase_order_id 
              AND received_quantity > 0
        ) THEN 'partially_received'
        ELSE status
    END,
    updated_at = now()
    WHERE id = grn_header_record.purchase_order_id;

    RETURN NEW;
END;
$function$;

-- 2) Add a lightweight trigger on GRN line items to "touch" the header
CREATE OR REPLACE FUNCTION public.touch_grn_header()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Touch the header to re-fire AFTER UPDATE trigger once items exist
  UPDATE public.grn_header 
  SET updated_at = now()
  WHERE id = NEW.grn_header_id;

  RETURN NEW;
END;
$function$;

-- Ensure header trigger exists and points to updated function
DROP TRIGGER IF EXISTS handle_grn_inventory_updates_trigger ON public.grn_header;
CREATE TRIGGER handle_grn_inventory_updates_trigger
  AFTER INSERT OR UPDATE ON public.grn_header
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_grn_inventory_updates();

-- Create/replace the line-item touch trigger
DROP TRIGGER IF EXISTS grn_line_items_touch_header ON public.grn_line_items;
CREATE TRIGGER grn_line_items_touch_header
  AFTER INSERT OR UPDATE OF accepted_quantity, received_quantity, rejected_quantity, warehouse_id, bin_id, unit_price
  ON public.grn_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_grn_header();

-- 3) Retro-trigger processing for the reported GRN; this will invoke header trigger
UPDATE public.grn_header
SET updated_at = now()
WHERE grn_number = 'RIGEGRN09022025003'
  AND status IN ('accepted','received','partially_received');

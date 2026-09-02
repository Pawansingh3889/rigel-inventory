-- Fix the trigger function by removing updated_at reference for purchase_order_items
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
    should_process_inventory BOOLEAN := false;
BEGIN
    -- Determine if we should process inventory transactions
    IF TG_OP = 'INSERT' AND NEW.status IN ('accepted', 'received', 'partially_received') THEN
        should_process_inventory := true;
    ELSIF TG_OP = 'UPDATE' AND NEW.status IN ('accepted', 'received', 'partially_received')
          AND (OLD.status IS NULL OR OLD.status NOT IN ('accepted', 'received', 'partially_received')) THEN
        should_process_inventory := true;
    END IF;

    IF should_process_inventory THEN
        grn_header_record := NEW;
        
        FOR item_record IN 
            SELECT * FROM public.grn_line_items 
            WHERE grn_header_id = NEW.id AND accepted_quantity > 0
        LOOP
            -- Validate that accepted quantity doesn't exceed pending quantity
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
            
            -- Record inventory transaction
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
            
            -- Update PO line items (removed updated_at since column doesn't exist)
            UPDATE public.purchase_order_items 
            SET received_quantity = received_quantity + item_record.accepted_quantity,
                pending_quantity = GREATEST(0, quantity - (received_quantity + item_record.accepted_quantity))
            WHERE purchase_order_id = grn_header_record.purchase_order_id 
              AND product_id = item_record.product_id;
        END LOOP;
        
        -- Update PO status based on pending quantities
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
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Now trigger the inventory processing for the existing GRN
UPDATE grn_header 
SET status = 'draft', updated_at = now()
WHERE grn_number = 'RIGEGRN09022025001';

UPDATE grn_header 
SET status = 'accepted', updated_at = now()
WHERE grn_number = 'RIGEGRN09022025001';
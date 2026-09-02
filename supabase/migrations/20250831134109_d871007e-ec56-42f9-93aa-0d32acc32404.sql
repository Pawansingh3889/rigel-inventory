-- Update the handle_grn_inventory_updates function to support both 'accepted' and 'received' statuses
CREATE OR REPLACE FUNCTION public.handle_grn_inventory_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    item_record RECORD;
    grn_header_record RECORD;
    po_item_record RECORD;
    pending_qty_after_grn INTEGER;
    total_pending_qty INTEGER := 0;
BEGIN
    -- Process when GRN status changes to 'accepted' or 'received'
    IF NEW.status IN ('accepted', 'received') AND (OLD IS NULL OR OLD.status NOT IN ('accepted', 'received')) THEN
        -- Get GRN header details
        SELECT * INTO grn_header_record FROM public.grn_header WHERE id = NEW.id;
        
        -- Process each line item
        FOR item_record IN 
            SELECT * FROM public.grn_line_items 
            WHERE grn_header_id = NEW.id AND accepted_quantity > 0
        LOOP
            -- Validate that accepted quantity doesn't exceed pending quantity
            SELECT pending_quantity INTO pending_qty_after_grn 
            FROM public.purchase_order_items 
            WHERE purchase_order_id = grn_header_record.purchase_order_id 
            AND product_id = item_record.product_id;
            
            -- Check if accepted quantity exceeds available pending quantity
            IF item_record.accepted_quantity > (pending_qty_after_grn + item_record.accepted_quantity) THEN
                RAISE EXCEPTION 'Accepted quantity (%) exceeds available pending quantity (%) for product %', 
                    item_record.accepted_quantity, pending_qty_after_grn, item_record.product_name;
            END IF;
            
            -- Update product stock with accepted quantity
            UPDATE public.products 
            SET stock_quantity = stock_quantity + item_record.accepted_quantity,
                updated_at = now()
            WHERE id = item_record.product_id;
            
            -- Record inventory transaction with correct type
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
                grn_header_record.created_by
            );
            
            -- Update PO line items with received quantities and pending quantities
            UPDATE public.purchase_order_items 
            SET received_quantity = received_quantity + item_record.accepted_quantity,
                pending_quantity = GREATEST(0, quantity - (received_quantity + item_record.accepted_quantity)),
                updated_at = now()
            WHERE purchase_order_id = grn_header_record.purchase_order_id 
            AND product_id = item_record.product_id;
        END LOOP;
        
        -- Calculate total pending quantity for all items in this PO
        SELECT SUM(pending_quantity) INTO total_pending_qty
        FROM public.purchase_order_items 
        WHERE purchase_order_id = grn_header_record.purchase_order_id;
        
        -- Update PO status based on pending quantities
        UPDATE public.purchase_orders 
        SET status = CASE 
            WHEN COALESCE(total_pending_qty, 0) = 0 THEN 'closed'
            WHEN EXISTS (
                SELECT 1 FROM public.purchase_order_items 
                WHERE purchase_order_id = grn_header_record.purchase_order_id 
                AND received_quantity > 0
            ) THEN 'partially_received'
            ELSE status  -- Keep existing status if no changes
        END,
        updated_at = now()
        WHERE id = grn_header_record.purchase_order_id;
    END IF;
    
    RETURN NEW;
END;
$function$;
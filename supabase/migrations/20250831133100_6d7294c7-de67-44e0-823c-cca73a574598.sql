-- Update the GRN inventory update function to improve status logic and use correct transaction type
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
    -- Only process when GRN status changes to 'accepted'
    IF NEW.status = 'accepted' AND (OLD IS NULL OR OLD.status != 'accepted') THEN
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
            SET received_quantity = received_quantity + item_record.received_quantity,
                pending_quantity = GREATEST(0, quantity - (received_quantity + item_record.received_quantity)),
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

-- Create a function to get PO status based on GRN existence and quantities
CREATE OR REPLACE FUNCTION public.get_purchase_order_status(po_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    has_grn boolean := false;
    total_pending_qty integer := 0;
    total_received_qty integer := 0;
BEGIN
    -- Check if any GRN exists for this PO
    SELECT EXISTS(
        SELECT 1 FROM public.grn_header 
        WHERE purchase_order_id = po_id
    ) INTO has_grn;
    
    -- Get pending and received quantities
    SELECT 
        COALESCE(SUM(pending_quantity), 0),
        COALESCE(SUM(received_quantity), 0)
    INTO total_pending_qty, total_received_qty
    FROM public.purchase_order_items 
    WHERE purchase_order_id = po_id;
    
    -- Determine status based on conditions
    IF NOT has_grn THEN
        RETURN 'open';
    ELSIF total_pending_qty = 0 THEN
        RETURN 'closed';
    ELSIF total_received_qty > 0 THEN
        RETURN 'partially_received';
    ELSE
        RETURN 'open';
    END IF;
END;
$function$;
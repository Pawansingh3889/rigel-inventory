-- Step 1: Clean up all existing GRN inventory triggers to eliminate conflicts
DROP TRIGGER IF EXISTS handle_grn_inventory_updates_trigger ON public.grn_header;
DROP TRIGGER IF EXISTS handle_grn_inventory_updates_on_insert ON public.grn_header;
DROP TRIGGER IF EXISTS handle_grn_inventory_updates_on_update ON public.grn_header;
DROP TRIGGER IF EXISTS grn_inventory_update_trigger ON public.grn_header;

-- Step 2: Create a single, consolidated trigger for both INSERT and UPDATE
CREATE TRIGGER handle_grn_inventory_updates_trigger
    AFTER INSERT OR UPDATE ON public.grn_header
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_grn_inventory_updates();

-- Step 3: Retroactively process missing GRN RIGEGRN09022025002
-- First, let's get the GRN details and process inventory transactions manually
DO $$
DECLARE
    grn_rec RECORD;
    item_rec RECORD;
    pending_qty_before INTEGER;
    total_pending_qty INTEGER := 0;
BEGIN
    -- Get the GRN record
    SELECT * INTO grn_rec 
    FROM public.grn_header 
    WHERE grn_number = 'RIGEGRN09022025002' 
    AND status IN ('accepted', 'received', 'partially_received');
    
    -- Only process if we found an accepted GRN
    IF grn_rec.id IS NOT NULL THEN
        -- Process each line item
        FOR item_rec IN 
            SELECT * FROM public.grn_line_items 
            WHERE grn_header_id = grn_rec.id AND accepted_quantity > 0
        LOOP
            -- Check if inventory transaction already exists
            IF NOT EXISTS (
                SELECT 1 FROM public.inventory_transactions 
                WHERE reference_id = grn_rec.id 
                AND product_id = item_rec.product_id
                AND transaction_type = 'purchase_receipt'
            ) THEN
                -- Validate pending quantity
                SELECT pending_quantity INTO pending_qty_before
                FROM public.purchase_order_items 
                WHERE purchase_order_id = grn_rec.purchase_order_id 
                  AND product_id = item_rec.product_id;

                IF pending_qty_before IS NULL THEN
                    pending_qty_before := 0;
                END IF;

                -- Only process if we have sufficient pending quantity
                IF item_rec.accepted_quantity <= pending_qty_before THEN
                    -- Update product stock
                    UPDATE public.products 
                    SET stock_quantity = stock_quantity + item_rec.accepted_quantity,
                        updated_at = now()
                    WHERE id = item_rec.product_id;
                    
                    -- Record inventory transaction
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
                    
                    -- Update PO line items
                    UPDATE public.purchase_order_items 
                    SET received_quantity = received_quantity + item_rec.accepted_quantity,
                        pending_quantity = GREATEST(0, quantity - (received_quantity + item_rec.accepted_quantity))
                    WHERE purchase_order_id = grn_rec.purchase_order_id 
                      AND product_id = item_rec.product_id;
                END IF;
            END IF;
        END LOOP;
        
        -- Update PO status based on pending quantities
        SELECT COALESCE(SUM(pending_quantity), 0) INTO total_pending_qty
        FROM public.purchase_order_items 
        WHERE purchase_order_id = grn_rec.purchase_order_id;

        UPDATE public.purchase_orders 
        SET status = CASE 
            WHEN total_pending_qty = 0 THEN 'closed'
            WHEN EXISTS (
                SELECT 1 FROM public.purchase_order_items 
                WHERE purchase_order_id = grn_rec.purchase_order_id 
                  AND received_quantity > 0
            ) THEN 'partially_received'
            ELSE status
        END
        WHERE id = grn_rec.purchase_order_id;
    END IF;
END $$;
-- Force inventory processing for the existing GRN by calling the function directly
DO $$ 
DECLARE
    grn_rec RECORD;
    item_record RECORD;
BEGIN
    -- Get the GRN record
    SELECT * INTO grn_rec 
    FROM grn_header 
    WHERE grn_number = 'RIGEGRN09022025001';
    
    IF grn_rec.id IS NOT NULL THEN
        RAISE LOG 'Processing GRN manually: %', grn_rec.grn_number;
        
        -- Process each line item manually
        FOR item_record IN 
            SELECT * FROM grn_line_items 
            WHERE grn_header_id = grn_rec.id AND accepted_quantity > 0
        LOOP
            RAISE LOG 'Processing item: % with quantity: %', item_record.product_name, item_record.accepted_quantity;
            
            -- Update product stock
            UPDATE products 
            SET stock_quantity = stock_quantity + item_record.accepted_quantity,
                updated_at = now()
            WHERE id = item_record.product_id;
            
            -- Create inventory transaction
            PERFORM record_inventory_transaction(
                grn_rec.company_id,
                'purchase_receipt'::transaction_type,
                grn_rec.id,
                grn_rec.grn_number,
                item_record.product_id,
                item_record.warehouse_id,
                item_record.bin_id,
                item_record.accepted_quantity,
                item_record.unit_price,
                'GRN Receipt - ' || grn_rec.grn_number,
                grn_rec.created_by
            );
            
            RAISE LOG 'Created inventory transaction for product: %', item_record.product_id;
            
            -- Update PO line items
            UPDATE purchase_order_items 
            SET received_quantity = received_quantity + item_record.accepted_quantity,
                pending_quantity = GREATEST(0, quantity - (received_quantity + item_record.accepted_quantity)),
                updated_at = now()
            WHERE purchase_order_id = grn_rec.purchase_order_id 
              AND product_id = item_record.product_id;
        END LOOP;
        
        RAISE LOG 'Manual GRN processing completed for: %', grn_rec.grn_number;
    END IF;
END $$;
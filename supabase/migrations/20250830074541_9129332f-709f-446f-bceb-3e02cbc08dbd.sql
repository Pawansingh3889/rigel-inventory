-- Add new fields to purchase_invoices table
ALTER TABLE public.purchase_invoices 
ADD COLUMN invoice_no text,
ADD COLUMN payment_due_date date;

-- Remove the auto-generation trigger for purchase invoice numbers
DROP TRIGGER IF EXISTS trigger_auto_generate_purchase_invoice_number ON public.purchase_invoices;

-- Update the purchase invoice items trigger to add products to inventory
CREATE OR REPLACE FUNCTION public.update_inventory_on_purchase_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    item_record RECORD;
    existing_product_id UUID;
BEGIN
    -- Only update inventory when invoice status is 'received'
    IF NEW.status = 'received' AND (OLD IS NULL OR OLD.status != 'received') THEN
        -- Process each item in the invoice
        FOR item_record IN 
            SELECT pii.product_id, pii.item_description, pii.item_code, pii.hsn_sac_code,
                   pii.unit_price, pii.quantity, pii.unit_of_measure
            FROM purchase_invoice_items pii 
            WHERE pii.purchase_invoice_id = NEW.id
        LOOP
            IF item_record.product_id IS NOT NULL THEN
                -- Update existing product stock
                UPDATE products 
                SET stock_quantity = stock_quantity + item_record.quantity,
                    updated_at = now()
                WHERE id = item_record.product_id;
            ELSE
                -- Check if product exists by item_code or description
                SELECT id INTO existing_product_id
                FROM products 
                WHERE company_id = NEW.company_id 
                AND (sku = item_record.item_code OR name = item_record.item_description)
                LIMIT 1;
                
                IF existing_product_id IS NOT NULL THEN
                    -- Update existing product
                    UPDATE products 
                    SET stock_quantity = stock_quantity + item_record.quantity,
                        updated_at = now()
                    WHERE id = existing_product_id;
                ELSE
                    -- Create new product from purchase invoice item
                    INSERT INTO products (
                        company_id,
                        name,
                        description,
                        sku,
                        hsn_code,
                        unit_price,
                        cost_price,
                        stock_quantity,
                        min_stock_level,
                        unit,
                        is_active
                    ) VALUES (
                        NEW.company_id,
                        item_record.item_description,
                        item_record.item_description,
                        COALESCE(item_record.item_code, 'PI-' || substring(gen_random_uuid()::text from 1 for 8)),
                        item_record.hsn_sac_code,
                        item_record.unit_price,
                        item_record.unit_price,
                        item_record.quantity,
                        0,
                        item_record.unit_of_measure,
                        true
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER trigger_update_inventory_on_purchase_invoice
    AFTER INSERT OR UPDATE ON public.purchase_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_inventory_on_purchase_invoice();
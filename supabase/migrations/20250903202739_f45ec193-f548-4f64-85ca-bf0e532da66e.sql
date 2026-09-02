-- Add warehouse_id and bin_id columns to sales_order_items table
-- Both reference the warehouse_bins table since warehouse data is stored there
ALTER TABLE public.sales_order_items 
ADD COLUMN warehouse_id UUID REFERENCES public.warehouse_bins(id),
ADD COLUMN bin_id UUID REFERENCES public.warehouse_bins(id);

-- Add warehouse_id and bin_id columns to sales_invoice_items table  
ALTER TABLE public.sales_invoice_items
ADD COLUMN warehouse_id UUID REFERENCES public.warehouse_bins(id),
ADD COLUMN bin_id UUID REFERENCES public.warehouse_bins(id);

-- Update process_sales_invoice function to use warehouse/bin from items and add validation
CREATE OR REPLACE FUNCTION public.process_sales_invoice(p_invoice_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    invoice_record RECORD;
    item_record RECORD;
    v_items_processed INTEGER := 0;
    v_transactions_created INTEGER := 0;
    total_ordered_qty INTEGER := 0;
    total_invoiced_qty INTEGER := 0;
    new_so_status TEXT;
    error_msg TEXT;
    result JSON;
    missing_warehouse_items TEXT := '';
BEGIN
    -- Load invoice record
    SELECT * INTO invoice_record FROM public.sales_invoices WHERE id = p_invoice_id;
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Sales invoice not found',
            'invoice_id', p_invoice_id
        );
    END IF;

    BEGIN
        -- Only process when invoice is posted/finalized
        IF invoice_record.status NOT IN ('posted', 'finalized') THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Invoice status not eligible for processing',
                'status', invoice_record.status,
                'invoice_number', invoice_record.invoice_number
            );
        END IF;

        -- Check for missing warehouse_id in finalized invoices
        SELECT string_agg(sii.item_description, ', ')
        INTO missing_warehouse_items
        FROM public.sales_invoice_items sii
        WHERE sii.sales_invoice_id = p_invoice_id 
        AND sii.warehouse_id IS NULL;

        IF missing_warehouse_items IS NOT NULL AND missing_warehouse_items != '' THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Missing warehouse information for items: ' || missing_warehouse_items,
                'invoice_number', invoice_record.invoice_number
            );
        END IF;

        -- Process each invoice item
        FOR item_record IN 
            SELECT * FROM public.sales_invoice_items WHERE sales_invoice_id = p_invoice_id
        LOOP
            v_items_processed := v_items_processed + 1;
            
            -- Update product stock (reduce by invoiced quantity)
            UPDATE public.products 
            SET stock_quantity = stock_quantity - item_record.quantity_invoiced,
                updated_at = now()
            WHERE id = item_record.product_id;

            -- Record inventory transaction for sales invoice
            PERFORM public.record_inventory_transaction(
                invoice_record.company_id,
                'sales_invoice'::transaction_type,
                invoice_record.id,
                invoice_record.invoice_number,
                item_record.product_id,
                item_record.warehouse_id,
                item_record.bin_id,
                -item_record.quantity_invoiced, -- negative for sales
                item_record.unit_price,
                'Sales Invoice - ' || invoice_record.invoice_number,
                invoice_record.created_by
            );
            
            v_transactions_created := v_transactions_created + 1;
        END LOOP;

        -- Update sales order status if linked
        IF invoice_record.sales_order_id IS NOT NULL THEN
            -- Get total ordered and invoiced quantities for this sales order
            SELECT 
                COALESCE(SUM(soi.quantity), 0),
                COALESCE(SUM(COALESCE(sii.quantity_invoiced, 0)), 0)
            INTO total_ordered_qty, total_invoiced_qty
            FROM public.sales_order_items soi
            LEFT JOIN public.sales_invoice_items sii ON soi.product_id = sii.product_id 
                AND sii.sales_invoice_id IN (
                    SELECT id FROM public.sales_invoices 
                    WHERE sales_order_id = invoice_record.sales_order_id 
                    AND status IN ('posted', 'finalized')
                )
            WHERE soi.sales_order_id = invoice_record.sales_order_id;

            -- Determine new sales order status
            IF total_invoiced_qty = 0 THEN
                new_so_status := 'confirmed';
            ELSIF total_invoiced_qty >= total_ordered_qty THEN
                new_so_status := 'closed';
            ELSE
                new_so_status := 'partially_delivered';
            END IF;

            -- Update sales order status
            UPDATE public.sales_orders 
            SET status = new_so_status,
                updated_at = now()
            WHERE id = invoice_record.sales_order_id;
        END IF;

        result := json_build_object(
            'success', true,
            'invoice_number', invoice_record.invoice_number,
            'items_processed', v_items_processed,
            'transactions_created', v_transactions_created,
            'so_status', new_so_status
        );

    EXCEPTION WHEN OTHERS THEN
        error_msg := SQLERRM;
        result := json_build_object(
            'success', false,
            'error', error_msg,
            'invoice_number', invoice_record.invoice_number,
            'items_processed', v_items_processed,
            'transactions_created', v_transactions_created
        );
    END;

    RETURN result;
END;
$function$;

-- Fix existing invoice RIGEINV1002 by setting default warehouse/bin
DO $$
DECLARE
    default_warehouse_bin_id UUID;
    invoice_id UUID;
BEGIN
    -- Get the first available warehouse bin
    SELECT wb.id INTO default_warehouse_bin_id
    FROM public.warehouse_bins wb
    WHERE wb.company_id = (
        SELECT company_id FROM public.sales_invoices 
        WHERE invoice_number = 'RIGEINV1002'
        LIMIT 1
    )
    LIMIT 1;

    -- Get invoice ID
    SELECT id INTO invoice_id 
    FROM public.sales_invoices 
    WHERE invoice_number = 'RIGEINV1002';

    -- Update sales invoice items with default warehouse/bin
    IF default_warehouse_bin_id IS NOT NULL AND invoice_id IS NOT NULL THEN
        UPDATE public.sales_invoice_items
        SET warehouse_id = default_warehouse_bin_id,
            bin_id = default_warehouse_bin_id
        WHERE sales_invoice_id = invoice_id
        AND warehouse_id IS NULL;

        -- Re-process the invoice to reduce inventory
        PERFORM public.process_sales_invoice(invoice_id);
    END IF;
END $$;
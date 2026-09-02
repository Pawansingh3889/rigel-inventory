-- Create RPC function to create return order
CREATE OR REPLACE FUNCTION public.create_return_order(
    p_company_id UUID,
    p_customer_id UUID,
    p_invoice_id UUID,
    p_reason_for_credit TEXT,
    p_return_lines JSONB,
    p_delivery_same_as_company BOOLEAN DEFAULT true,
    p_delivery_address_line1 TEXT DEFAULT NULL,
    p_delivery_address_line2 TEXT DEFAULT NULL,
    p_delivery_city TEXT DEFAULT NULL,
    p_delivery_country TEXT DEFAULT NULL,
    p_delivery_pin_code TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_return_order_id UUID;
    v_customer_name TEXT;
    v_invoice_number TEXT;
    v_invoice_date DATE;
    line_item JSONB;
    v_subtotal NUMERIC := 0;
    v_tax_amount NUMERIC := 0;
    v_total_amount NUMERIC := 0;
BEGIN
    -- Get customer and invoice details
    SELECT c.name INTO v_customer_name FROM public.customers c WHERE c.id = p_customer_id;
    SELECT si.invoice_number, si.invoice_date INTO v_invoice_number, v_invoice_date 
    FROM public.sales_invoices si WHERE si.id = p_invoice_id;
    
    -- Create return order header
    INSERT INTO public.return_order_header (
        company_id,
        customer_id,
        customer_name,
        invoice_id,
        invoice_number,
        invoice_date,
        reason_for_credit,
        delivery_same_as_company,
        delivery_address_line1,
        delivery_address_line2,
        delivery_city,
        delivery_country,
        delivery_pin_code,
        notes,
        created_by
    ) VALUES (
        p_company_id,
        p_customer_id,
        v_customer_name,
        p_invoice_id,
        v_invoice_number,
        v_invoice_date,
        p_reason_for_credit,
        p_delivery_same_as_company,
        p_delivery_address_line1,
        p_delivery_address_line2,
        p_delivery_city,
        p_delivery_country,
        p_delivery_pin_code,
        p_notes,
        auth.uid()
    ) RETURNING id INTO v_return_order_id;
    
    -- Process return lines
    FOR line_item IN SELECT * FROM jsonb_array_elements(p_return_lines)
    LOOP
        IF (line_item->>'return_qty')::INTEGER > 0 THEN
            INSERT INTO public.return_order_lines (
                return_order_id,
                product_id,
                product_name,
                product_sku,
                hsn_sac_code,
                unit_of_measure,
                invoice_qty,
                return_qty,
                pending_return_qty,
                unit_price,
                discount_percentage,
                discount_amount,
                cgst_rate,
                cgst_amount,
                sgst_rate,
                sgst_amount,
                igst_rate,
                igst_amount,
                line_subtotal,
                tax_amount,
                line_total
            ) VALUES (
                v_return_order_id,
                (line_item->>'product_id')::UUID,
                line_item->>'product_name',
                line_item->>'product_sku',
                line_item->>'hsn_sac_code',
                line_item->>'unit_of_measure',
                (line_item->>'invoice_qty')::INTEGER,
                (line_item->>'return_qty')::INTEGER,
                (line_item->>'invoice_qty')::INTEGER - (line_item->>'return_qty')::INTEGER,
                (line_item->>'unit_price')::NUMERIC,
                COALESCE((line_item->>'discount_percentage')::NUMERIC, 0),
                (line_item->>'discount_amount')::NUMERIC,
                COALESCE((line_item->>'cgst_rate')::NUMERIC, 0),
                (line_item->>'cgst_amount')::NUMERIC,
                COALESCE((line_item->>'sgst_rate')::NUMERIC, 0),
                (line_item->>'sgst_amount')::NUMERIC,
                COALESCE((line_item->>'igst_rate')::NUMERIC, 0),
                (line_item->>'igst_amount')::NUMERIC,
                (line_item->>'line_subtotal')::NUMERIC,
                (line_item->>'tax_amount')::NUMERIC,
                (line_item->>'line_total')::NUMERIC
            );
            
            -- Add to totals
            v_subtotal := v_subtotal + (line_item->>'line_subtotal')::NUMERIC;
            v_tax_amount := v_tax_amount + (line_item->>'tax_amount')::NUMERIC;
            v_total_amount := v_total_amount + (line_item->>'line_total')::NUMERIC;
        END IF;
    END LOOP;
    
    -- Update header totals
    UPDATE public.return_order_header 
    SET subtotal_amount = v_subtotal,
        tax_amount = v_tax_amount,
        total_amount = v_total_amount,
        updated_at = now()
    WHERE id = v_return_order_id;
    
    RETURN json_build_object(
        'success', true,
        'return_order_id', v_return_order_id,
        'rso_number', (SELECT rso_number FROM public.return_order_header WHERE id = v_return_order_id)
    );
END;
$$;

-- Create RPC function to confirm return order
CREATE OR REPLACE FUNCTION public.confirm_return_order(p_return_order_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_return_order RECORD;
    line_item RECORD;
    v_items_processed INTEGER := 0;
    v_transactions_created INTEGER := 0;
BEGIN
    -- Get return order details
    SELECT * INTO v_return_order FROM public.return_order_header WHERE id = p_return_order_id;
    
    -- Check if already confirmed
    IF v_return_order.status = 'Confirmed' THEN
        RETURN json_build_object('success', false, 'error', 'Return order already confirmed');
    END IF;
    
    -- Process each return line
    FOR line_item IN 
        SELECT * FROM public.return_order_lines WHERE return_order_id = p_return_order_id AND return_qty > 0
    LOOP
        v_items_processed := v_items_processed + 1;
        
        -- Update product stock (increase by return quantity)
        UPDATE public.products 
        SET stock_quantity = stock_quantity + line_item.return_qty,
            updated_at = now()
        WHERE id = line_item.product_id;
        
        -- Record inventory transaction for return
        PERFORM public.record_inventory_transaction(
            v_return_order.company_id,
            'sales_return'::transaction_type,
            v_return_order.id,
            v_return_order.rso_number,
            line_item.product_id,
            NULL, -- warehouse_id
            NULL, -- bin_id  
            line_item.return_qty, -- positive for returns (increases stock)
            line_item.unit_price,
            'Sales Return - ' || v_return_order.rso_number,
            v_return_order.created_by
        );
        
        v_transactions_created := v_transactions_created + 1;
    END LOOP;
    
    -- Update return order status
    UPDATE public.return_order_header 
    SET status = 'Confirmed',
        updated_at = now()
    WHERE id = p_return_order_id;
    
    RETURN json_build_object(
        'success', true,
        'rso_number', v_return_order.rso_number,
        'items_processed', v_items_processed,
        'transactions_created', v_transactions_created
    );
END;
$$;
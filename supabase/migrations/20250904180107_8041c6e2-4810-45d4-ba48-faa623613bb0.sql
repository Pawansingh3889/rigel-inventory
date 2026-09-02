-- Add status parameter to create_return_order function
CREATE OR REPLACE FUNCTION public.create_return_order(
    p_company_id uuid, 
    p_customer_id uuid, 
    p_invoice_id uuid, 
    p_reason_for_credit text, 
    p_return_lines jsonb, 
    p_delivery_same_as_company boolean DEFAULT true, 
    p_delivery_address_line1 text DEFAULT NULL::text, 
    p_delivery_address_line2 text DEFAULT NULL::text, 
    p_delivery_city text DEFAULT NULL::text, 
    p_delivery_country text DEFAULT NULL::text, 
    p_delivery_pin_code text DEFAULT NULL::text, 
    p_notes text DEFAULT NULL::text,
    p_status text DEFAULT 'Draft'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_return_order_id UUID;
    v_customer_name TEXT;
    v_invoice_number TEXT;
    v_invoice_date DATE;
    line_item JSONB;
    v_subtotal NUMERIC := 0;
    v_tax_amount NUMERIC := 0;
    v_total_amount NUMERIC := 0;
    v_invoice_qty INTEGER;
    v_already_returned INTEGER;
    v_available_to_return INTEGER;
    v_rso_number TEXT;
BEGIN
    -- Get customer and invoice details
    SELECT c.name INTO v_customer_name FROM public.customers c WHERE c.id = p_customer_id;
    SELECT si.invoice_number, si.invoice_date INTO v_invoice_number, v_invoice_date 
    FROM public.sales_invoices si WHERE si.id = p_invoice_id;
    
    -- Validate all return lines before creating return order
    FOR line_item IN SELECT * FROM jsonb_array_elements(p_return_lines)
    LOOP
        -- Get original invoice quantity
        SELECT sii.quantity_invoiced INTO v_invoice_qty
        FROM public.sales_invoice_items sii
        WHERE sii.sales_invoice_id = p_invoice_id 
        AND sii.product_id = (line_item->>'product_id')::UUID;
        
        -- Calculate already returned quantity for this product on this invoice
        SELECT COALESCE(SUM(rol.return_qty), 0) INTO v_already_returned
        FROM public.return_order_lines rol
        JOIN public.return_order_header roh ON rol.return_order_id = roh.id
        WHERE roh.invoice_id = p_invoice_id
        AND rol.product_id = (line_item->>'product_id')::UUID;
        
        -- Calculate available to return
        v_available_to_return := COALESCE(v_invoice_qty, 0) - COALESCE(v_already_returned, 0);
        
        -- Validate return quantity doesn't exceed available
        IF (line_item->>'return_qty')::INTEGER > v_available_to_return THEN
            RAISE EXCEPTION 'Return quantity % exceeds available quantity % for product %', 
                (line_item->>'return_qty')::INTEGER, 
                v_available_to_return, 
                line_item->>'product_name';
        END IF;
        
        -- Calculate totals
        v_subtotal := v_subtotal + (line_item->>'line_subtotal')::NUMERIC;
        v_tax_amount := v_tax_amount + (line_item->>'tax_amount')::NUMERIC;
        v_total_amount := v_total_amount + (line_item->>'line_total')::NUMERIC;
    END LOOP;
    
    -- Generate RSO number
    v_rso_number := public.generate_rso_number(p_customer_id, p_company_id);
    
    -- Create return order header
    INSERT INTO public.return_order_header (
        company_id, customer_id, customer_name, invoice_id, invoice_number, invoice_date,
        reason_for_credit, delivery_same_as_company, delivery_address_line1, 
        delivery_address_line2, delivery_city, delivery_country, delivery_pin_code,
        status, subtotal_amount, tax_amount, total_amount, notes, created_by, rso_number
    )
    VALUES (
        p_company_id, p_customer_id, v_customer_name, p_invoice_id, v_invoice_number, v_invoice_date,
        p_reason_for_credit, p_delivery_same_as_company, p_delivery_address_line1,
        p_delivery_address_line2, p_delivery_city, p_delivery_country, p_delivery_pin_code,
        p_status, v_subtotal, v_tax_amount, v_total_amount, p_notes, auth.uid(), v_rso_number
    )
    RETURNING id INTO v_return_order_id;
    
    -- Create return order lines
    FOR line_item IN SELECT * FROM jsonb_array_elements(p_return_lines)
    LOOP
        INSERT INTO public.return_order_lines (
            return_order_id, product_id, product_name, product_sku, hsn_sac_code,
            unit_of_measure, invoice_qty, return_qty, pending_return_qty, unit_price,
            discount_percentage, discount_amount, cgst_rate, cgst_amount, sgst_rate,
            sgst_amount, igst_rate, igst_amount, line_subtotal, tax_amount, line_total
        )
        VALUES (
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
            (line_item->>'discount_percentage')::NUMERIC,
            (line_item->>'discount_amount')::NUMERIC,
            (line_item->>'cgst_rate')::NUMERIC,
            (line_item->>'cgst_amount')::NUMERIC,
            (line_item->>'sgst_rate')::NUMERIC,
            (line_item->>'sgst_amount')::NUMERIC,
            (line_item->>'igst_rate')::NUMERIC,
            (line_item->>'igst_amount')::NUMERIC,
            (line_item->>'line_subtotal')::NUMERIC,
            (line_item->>'tax_amount')::NUMERIC,
            (line_item->>'line_total')::NUMERIC
        );
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'return_order_id', v_return_order_id,
        'rso_number', v_rso_number,
        'message', 'Return order created successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to create return order'
        );
END;
$function$
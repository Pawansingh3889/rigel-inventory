-- Add function to handle confirmed return order deletion with inventory reversal
CREATE OR REPLACE FUNCTION public.delete_confirmed_return_order(p_return_order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_return_order RECORD;
    line_item RECORD;
BEGIN
    -- Get return order details
    SELECT * INTO v_return_order FROM public.return_order_header WHERE id = p_return_order_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Return order not found');
    END IF;
    
    -- Reverse inventory transactions if confirmed
    IF v_return_order.status = 'Confirmed' THEN
        FOR line_item IN 
            SELECT * FROM public.return_order_lines WHERE return_order_id = p_return_order_id AND return_qty > 0
        LOOP
            -- Reverse inventory (reduce stock by return quantity since we're undoing the return)
            UPDATE public.products 
            SET stock_quantity = stock_quantity - line_item.return_qty,
                updated_at = now()
            WHERE id = line_item.product_id;
            
            -- Remove inventory transaction record
            DELETE FROM public.inventory_transactions
            WHERE transaction_type = 'sales_return'
            AND reference_id = p_return_order_id
            AND product_id = line_item.product_id;
        END LOOP;
    END IF;
    
    -- Delete return order lines first
    DELETE FROM public.return_order_lines WHERE return_order_id = p_return_order_id;
    
    -- Delete return order header
    DELETE FROM public.return_order_header WHERE id = p_return_order_id;
    
    RETURN json_build_object(
        'success', true, 
        'message', 'Return order deleted successfully',
        'rso_number', v_return_order.rso_number
    );
END;
$function$
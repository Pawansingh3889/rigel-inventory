-- Rewrite confirm_return_order function to only update status (no inventory impact)
CREATE OR REPLACE FUNCTION public.confirm_return_order(p_return_order_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_return_order RECORD;
BEGIN
    -- Get return order details
    SELECT * INTO v_return_order FROM public.return_order_header WHERE id = p_return_order_id;
    
    -- Check if return order exists
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Return order not found');
    END IF;
    
    -- Check if already confirmed
    IF v_return_order.status = 'Confirmed' THEN
        RETURN json_build_object('success', false, 'error', 'Return order already confirmed');
    END IF;
    
    -- Update return order status to Confirmed (no inventory changes)
    UPDATE public.return_order_header 
    SET status = 'Confirmed',
        updated_at = now()
    WHERE id = p_return_order_id;
    
    RETURN json_build_object(
        'success', true,
        'rso_number', v_return_order.rso_number,
        'message', 'Return order confirmed successfully'
    );
END;
$function$
-- Fix the record_inventory_transaction function to handle NULL created_by
CREATE OR REPLACE FUNCTION public.record_inventory_transaction(
    p_company_id uuid, 
    p_transaction_type transaction_type, 
    p_reference_id uuid, 
    p_reference_number text, 
    p_product_id uuid, 
    p_warehouse_id uuid, 
    p_bin_id uuid, 
    p_quantity_change integer, 
    p_unit_cost numeric DEFAULT 0, 
    p_notes text DEFAULT NULL::text, 
    p_created_by uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    transaction_id UUID;
    calculated_total_value NUMERIC;
    effective_created_by UUID;
BEGIN
    -- Calculate total value
    calculated_total_value := p_quantity_change * COALESCE(p_unit_cost, 0);
    
    -- Determine effective created_by: use provided value or fall back to auth.uid()
    effective_created_by := COALESCE(p_created_by, auth.uid());
    
    -- If still null, use a system user (first available profile)
    IF effective_created_by IS NULL THEN
        SELECT user_id INTO effective_created_by 
        FROM public.profiles 
        WHERE company_id = p_company_id 
        LIMIT 1;
    END IF;
    
    -- Insert transaction record
    INSERT INTO public.inventory_transactions (
        company_id,
        transaction_type,
        reference_id,
        reference_number,
        product_id,
        warehouse_id,
        bin_id,
        quantity_change,
        unit_cost,
        total_value,
        notes,
        created_by
    ) VALUES (
        p_company_id,
        p_transaction_type,
        p_reference_id,
        p_reference_number,
        p_product_id,
        p_warehouse_id,
        p_bin_id,
        p_quantity_change,
        COALESCE(p_unit_cost, 0),
        calculated_total_value,
        p_notes,
        effective_created_by
    ) RETURNING id INTO transaction_id;
    
    RETURN transaction_id;
END;
$function$;
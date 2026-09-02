-- Fix remaining function search_path issues
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
SET search_path = public
AS $$
DECLARE
    transaction_id UUID;
    calculated_total_value NUMERIC;
BEGIN
    -- Calculate total value
    calculated_total_value := p_quantity_change * COALESCE(p_unit_cost, 0);
    
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
        COALESCE(p_created_by, auth.uid())
    ) RETURNING id INTO transaction_id;
    
    RETURN transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_purchase_invoice_number(comp_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    company_name TEXT;
    first_four_letters TEXT;
    counter INTEGER;
    invoice_number TEXT;
BEGIN
    -- Get company name
    SELECT name INTO company_name FROM public.companies WHERE id = comp_id;
    
    -- Extract first 4 letters from company name
    first_four_letters := UPPER(SUBSTRING(REGEXP_REPLACE(company_name, '[^A-Za-z]', '', 'g') FROM 1 FOR 4));
    
    -- Ensure we have at least 4 characters, pad with 'X' if needed
    WHILE LENGTH(first_four_letters) < 4 LOOP
        first_four_letters := first_four_letters || 'X';
    END LOOP;
    
    -- Get the next invoice counter for this company
    SELECT COALESCE(MAX(CAST(SUBSTRING(pi.purchase_invoice_number FROM LENGTH('PI-' || first_four_letters) + 1) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.purchase_invoices pi
    WHERE pi.company_id = comp_id 
    AND pi.purchase_invoice_number LIKE 'PI-' || first_four_letters || '%';
    
    -- Generate invoice number
    invoice_number := 'PI-' || first_four_letters || LPAD(counter::TEXT, 3, '0');
    
    RETURN invoice_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_company_invoice_number(comp_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  company_name TEXT;
  first_four TEXT;
  counter INTEGER;
  inv_no TEXT;
BEGIN
  -- Get company name
  SELECT name INTO company_name FROM public.companies WHERE id = comp_id;

  -- First 4 letters, letters only, pad with X if needed
  first_four := UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(company_name, ''), '[^A-Za-z]', '', 'g') FROM 1 FOR 4));
  WHILE LENGTH(first_four) < 4 LOOP
    first_four := first_four || 'X';
  END LOOP;

  -- Find next sequence for this company
  SELECT COALESCE(
           MAX(
             CAST(
               SUBSTRING(pi.performa_invoice_number FROM LENGTH('INV-' || first_four || '-') + 1) 
               AS INTEGER
             )
           ), 
           0
         ) + 1
  INTO counter
  FROM public.performa_invoices pi
  WHERE pi.company_id = comp_id
    AND pi.performa_invoice_number LIKE 'INV-' || first_four || '-%';

  inv_no := 'INV-' || first_four || '-' || LPAD(counter::text, 3, '0');
  RETURN inv_no;
END;
$$;
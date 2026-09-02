-- Make product_id optional in purchase_order_items table
ALTER TABLE public.purchase_order_items 
ALTER COLUMN product_id DROP NOT NULL;

-- Fix the generate_po_number function to avoid ambiguous column reference
CREATE OR REPLACE FUNCTION public.generate_po_number(comp_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    company_name TEXT;
    first_four_letters TEXT;
    counter INTEGER;
    po_number TEXT;
BEGIN
    -- Get company name
    SELECT name INTO company_name FROM companies WHERE id = comp_id;
    
    -- Extract first 4 letters from company name
    first_four_letters := UPPER(SUBSTRING(REGEXP_REPLACE(company_name, '[^A-Za-z]', '', 'g') FROM 1 FOR 4));
    
    -- Ensure we have at least 4 characters, pad with 'X' if needed
    WHILE LENGTH(first_four_letters) < 4 LOOP
        first_four_letters := first_four_letters || 'X';
    END LOOP;
    
    -- Get the next PO counter for this company using table alias
    SELECT COALESCE(MAX(CAST(SUBSTRING(po.po_number FROM LENGTH('PO-' || first_four_letters) + 1) AS INTEGER)), 0) + 1
    INTO counter
    FROM purchase_orders po
    WHERE po.company_id = comp_id 
    AND po.po_number LIKE 'PO-' || first_four_letters || '%';
    
    -- Generate PO number
    po_number := 'PO-' || first_four_letters || LPAD(counter::TEXT, 3, '0');
    
    RETURN po_number;
END;
$function$;
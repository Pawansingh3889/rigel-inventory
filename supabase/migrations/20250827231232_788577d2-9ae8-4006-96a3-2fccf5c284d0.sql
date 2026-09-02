-- Check if purchase_order_items table needs updates for comprehensive PO management
-- Add missing fields for comprehensive purchase order line items

-- Add missing columns to purchase_order_items if they don't exist
DO $$ 
BEGIN
    -- Check and add item_code column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'item_code') THEN
        ALTER TABLE public.purchase_order_items ADD COLUMN item_code TEXT;
    END IF;
    
    -- Check and add item_description column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'item_description') THEN
        ALTER TABLE public.purchase_order_items ADD COLUMN item_description TEXT NOT NULL DEFAULT '';
    END IF;
    
    -- Check and add hsn_sac_code column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'hsn_sac_code') THEN
        ALTER TABLE public.purchase_order_items ADD COLUMN hsn_sac_code TEXT;
    END IF;
    
    -- Check and add unit_of_measure column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'unit_of_measure') THEN
        ALTER TABLE public.purchase_order_items ADD COLUMN unit_of_measure TEXT NOT NULL DEFAULT 'pcs';
    END IF;
    
    -- Check and add discount_percentage column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'discount_percentage') THEN
        ALTER TABLE public.purchase_order_items ADD COLUMN discount_percentage NUMERIC DEFAULT 0;
    END IF;
    
    -- Check and add discount_amount column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'discount_amount') THEN
        ALTER TABLE public.purchase_order_items ADD COLUMN discount_amount NUMERIC DEFAULT 0;
    END IF;
    
    -- Check and add taxable_value column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'taxable_value') THEN
        ALTER TABLE public.purchase_order_items ADD COLUMN taxable_value NUMERIC DEFAULT 0;
    END IF;
    
    -- Check and add gst_rate column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'gst_rate') THEN
        ALTER TABLE public.purchase_order_items ADD COLUMN gst_rate NUMERIC DEFAULT 0;
    END IF;
    
    -- Check and add cgst_amount column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'cgst_amount') THEN
        ALTER TABLE public.purchase_order_items ADD COLUMN cgst_amount NUMERIC DEFAULT 0;
    END IF;
    
    -- Check and add sgst_amount column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'sgst_amount') THEN
        ALTER TABLE public.purchase_order_items ADD COLUMN sgst_amount NUMERIC DEFAULT 0;
    END IF;
    
    -- Check and add igst_amount column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'igst_amount') THEN
        ALTER TABLE public.purchase_order_items ADD COLUMN igst_amount NUMERIC DEFAULT 0;
    END IF;
    
    -- Check and add remarks column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'remarks') THEN
        ALTER TABLE public.purchase_order_items ADD COLUMN remarks TEXT;
    END IF;
END $$;

-- Add missing fields to purchase_orders table for comprehensive PO management
DO $$ 
BEGIN
    -- Check and add external_po_ref column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'external_po_ref') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN external_po_ref TEXT;
    END IF;
    
    -- Check and add supplier_code column (will be populated from supplier data)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplier_code') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN supplier_code TEXT;
    END IF;
    
    -- Check and add supplier_contact_person column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplier_contact_person') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN supplier_contact_person TEXT;
    END IF;
    
    -- Check and add supplier_contact_email column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplier_contact_email') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN supplier_contact_email TEXT;
    END IF;
    
    -- Check and add supplier_contact_phone column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplier_contact_phone') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN supplier_contact_phone TEXT;
    END IF;
    
    -- Check and add supplier_gstin column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplier_gstin') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN supplier_gstin TEXT;
    END IF;
    
    -- Check and add subtotal_amount column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'subtotal_amount') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN subtotal_amount NUMERIC DEFAULT 0;
    END IF;
    
    -- Check and add total_discount_amount column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'total_discount_amount') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN total_discount_amount NUMERIC DEFAULT 0;
    END IF;
    
    -- Check and add total_tax_amount column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'total_tax_amount') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN total_tax_amount NUMERIC DEFAULT 0;
    END IF;
    
    -- Check and add company_place_of_supply column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'company_place_of_supply') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN company_place_of_supply TEXT;
    END IF;
END $$;

-- Update PO number generation function to use company name format
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
    
    -- Get the next PO counter for this company
    SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM LENGTH('PO-' || first_four_letters) + 1) AS INTEGER)), 0) + 1
    INTO counter
    FROM purchase_orders
    WHERE company_id = comp_id 
    AND po_number LIKE 'PO-' || first_four_letters || '%';
    
    -- Generate PO number
    po_number := 'PO-' || first_four_letters || LPAD(counter::TEXT, 3, '0');
    
    RETURN po_number;
END;
$function$;
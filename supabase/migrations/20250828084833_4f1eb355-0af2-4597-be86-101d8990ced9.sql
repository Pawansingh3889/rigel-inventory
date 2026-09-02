-- Create purchase invoices table
CREATE TABLE public.purchase_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  purchase_invoice_number TEXT NOT NULL,
  purchase_invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  purchase_order_id UUID,
  status TEXT NOT NULL DEFAULT 'received',
  subtotal_amount NUMERIC NOT NULL DEFAULT 0,
  total_discount_amount NUMERIC NOT NULL DEFAULT 0,
  total_tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  place_of_supply TEXT,
  supplier_code TEXT,
  supplier_contact_person TEXT,
  supplier_contact_email TEXT,
  supplier_contact_phone TEXT,
  supplier_gstin TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create purchase invoice items table
CREATE TABLE public.purchase_invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_invoice_id UUID NOT NULL,
  product_id UUID,
  item_code TEXT,
  item_description TEXT NOT NULL DEFAULT '',
  hsn_sac_code TEXT,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  discount_percentage NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  taxable_value NUMERIC DEFAULT 0,
  cgst_rate NUMERIC DEFAULT 0,
  sgst_rate NUMERIC DEFAULT 0,
  igst_rate NUMERIC DEFAULT 0,
  cgst_amount NUMERIC DEFAULT 0,
  sgst_amount NUMERIC DEFAULT 0,
  igst_amount NUMERIC DEFAULT 0,
  total_price NUMERIC NOT NULL,
  is_taxable BOOLEAN DEFAULT true,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for purchase invoices
CREATE POLICY "Company isolation for purchase invoices" 
ON public.purchase_invoices 
FOR ALL 
USING (company_id = user_company_id());

-- Create RLS policies for purchase invoice items
CREATE POLICY "Purchase invoice items access" 
ON public.purchase_invoice_items 
FOR ALL 
USING (purchase_invoice_id IN (
  SELECT id FROM public.purchase_invoices 
  WHERE company_id = user_company_id()
));

-- Create indexes for better performance
CREATE INDEX idx_purchase_invoices_company_id ON public.purchase_invoices(company_id);
CREATE INDEX idx_purchase_invoices_supplier_id ON public.purchase_invoices(supplier_id);
CREATE INDEX idx_purchase_invoices_date ON public.purchase_invoices(purchase_invoice_date);
CREATE INDEX idx_purchase_invoice_items_invoice_id ON public.purchase_invoice_items(purchase_invoice_id);
CREATE INDEX idx_purchase_invoice_items_product_id ON public.purchase_invoice_items(product_id);

-- Create trigger for updating timestamps
CREATE TRIGGER update_purchase_invoices_updated_at
  BEFORE UPDATE ON public.purchase_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate purchase invoice number
CREATE OR REPLACE FUNCTION public.generate_purchase_invoice_number(comp_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    company_name TEXT;
    first_four_letters TEXT;
    counter INTEGER;
    invoice_number TEXT;
BEGIN
    -- Get company name
    SELECT name INTO company_name FROM companies WHERE id = comp_id;
    
    -- Extract first 4 letters from company name
    first_four_letters := UPPER(SUBSTRING(REGEXP_REPLACE(company_name, '[^A-Za-z]', '', 'g') FROM 1 FOR 4));
    
    -- Ensure we have at least 4 characters, pad with 'X' if needed
    WHILE LENGTH(first_four_letters) < 4 LOOP
        first_four_letters := first_four_letters || 'X';
    END LOOP;
    
    -- Get the next invoice counter for this company
    SELECT COALESCE(MAX(CAST(SUBSTRING(pi.purchase_invoice_number FROM LENGTH('PI-' || first_four_letters) + 1) AS INTEGER)), 0) + 1
    INTO counter
    FROM purchase_invoices pi
    WHERE pi.company_id = comp_id 
    AND pi.purchase_invoice_number LIKE 'PI-' || first_four_letters || '%';
    
    -- Generate invoice number
    invoice_number := 'PI-' || first_four_letters || LPAD(counter::TEXT, 3, '0');
    
    RETURN invoice_number;
END;
$function$;

-- Create trigger function to auto-generate purchase invoice number
CREATE OR REPLACE FUNCTION public.auto_generate_purchase_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.purchase_invoice_number IS NULL OR NEW.purchase_invoice_number = '' THEN
        NEW.purchase_invoice_number := generate_purchase_invoice_number(NEW.company_id);
    END IF;
    RETURN NEW;
END;
$function$;

-- Create trigger to auto-generate purchase invoice number
CREATE TRIGGER auto_generate_purchase_invoice_number_trigger
    BEFORE INSERT ON public.purchase_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_purchase_invoice_number();

-- Function to update product inventory when purchase invoice is created
CREATE OR REPLACE FUNCTION public.update_inventory_on_purchase_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    item_record RECORD;
BEGIN
    -- Only update inventory when invoice status is 'received'
    IF NEW.status = 'received' AND (OLD IS NULL OR OLD.status != 'received') THEN
        -- Update product stock for each item in the invoice
        FOR item_record IN 
            SELECT pii.product_id, pii.quantity 
            FROM purchase_invoice_items pii 
            WHERE pii.purchase_invoice_id = NEW.id AND pii.product_id IS NOT NULL
        LOOP
            UPDATE products 
            SET stock_quantity = stock_quantity + item_record.quantity,
                updated_at = now()
            WHERE id = item_record.product_id;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Create trigger to update inventory
CREATE TRIGGER update_inventory_on_purchase_invoice_trigger
    AFTER INSERT OR UPDATE ON public.purchase_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_inventory_on_purchase_invoice();
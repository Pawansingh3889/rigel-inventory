-- Create GRN (Goods Receipt Note) tables

-- Create GRN header table
CREATE TABLE public.grn_header (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  grn_number TEXT NOT NULL,
  grn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  purchase_order_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_invoice_number TEXT,
  supplier_invoice_date DATE,
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'received', 'accepted', 'rejected')),
  total_ordered_quantity INTEGER NOT NULL DEFAULT 0,
  total_received_quantity INTEGER NOT NULL DEFAULT 0,
  total_accepted_quantity INTEGER NOT NULL DEFAULT 0,
  total_rejected_quantity INTEGER NOT NULL DEFAULT 0,
  subtotal_amount NUMERIC NOT NULL DEFAULT 0,
  total_discount_amount NUMERIC NOT NULL DEFAULT 0,
  total_tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create GRN line items table
CREATE TABLE public.grn_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_header_id UUID NOT NULL REFERENCES public.grn_header(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  ordered_quantity INTEGER NOT NULL,
  received_quantity INTEGER NOT NULL DEFAULT 0,
  accepted_quantity INTEGER NOT NULL DEFAULT 0,
  rejected_quantity INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_percentage NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  warehouse_id UUID,
  bin_id UUID,
  hsn_sac_code TEXT,
  cgst_rate NUMERIC DEFAULT 0,
  cgst_amount NUMERIC DEFAULT 0,
  sgst_rate NUMERIC DEFAULT 0,
  sgst_amount NUMERIC DEFAULT 0,
  igst_rate NUMERIC DEFAULT 0,
  igst_amount NUMERIC DEFAULT 0,
  total_tax_amount NUMERIC DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.grn_header ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn_line_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for grn_header
CREATE POLICY "Company isolation for grn_header" 
ON public.grn_header 
FOR ALL 
USING (company_id = user_company_id());

-- Create RLS policies for grn_line_items
CREATE POLICY "GRN line items access" 
ON public.grn_line_items 
FOR ALL 
USING (grn_header_id IN (
  SELECT id FROM public.grn_header 
  WHERE company_id = user_company_id()
));

-- Create function to generate GRN number
CREATE OR REPLACE FUNCTION public.generate_grn_number(comp_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    company_name TEXT;
    first_four_letters TEXT;
    current_date_str TEXT;
    counter INTEGER;
    grn_number TEXT;
BEGIN
    -- Get company name
    SELECT name INTO company_name FROM public.companies WHERE id = comp_id;
    
    -- Extract first 4 letters from company name
    first_four_letters := UPPER(SUBSTRING(REGEXP_REPLACE(company_name, '[^A-Za-z]', '', 'g') FROM 1 FOR 4));
    
    -- Ensure we have at least 4 characters, pad with 'X' if needed
    WHILE LENGTH(first_four_letters) < 4 LOOP
        first_four_letters := first_four_letters || 'X';
    END LOOP;
    
    -- Get current date in MMDDYYYY format
    current_date_str := to_char(now(), 'MMDDYYYY');
    
    -- Get the next counter for this company and date
    SELECT COALESCE(MAX(
        CASE 
            WHEN grn_number LIKE first_four_letters || 'GRN' || current_date_str || '%' THEN
                CAST(SUBSTRING(grn_number FROM LENGTH(first_four_letters || 'GRN' || current_date_str) + 1) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO counter
    FROM public.grn_header
    WHERE company_id = comp_id;
    
    -- Generate GRN number: COMPGRN + MMDDYYYY + counter
    grn_number := first_four_letters || 'GRN' || current_date_str || LPAD(counter::TEXT, 3, '0');
    
    RETURN grn_number;
END;
$$;

-- Create trigger function for auto-generating GRN number
CREATE OR REPLACE FUNCTION public.auto_generate_grn_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    IF NEW.grn_number IS NULL OR NEW.grn_number = '' THEN
        NEW.grn_number := public.generate_grn_number(NEW.company_id);
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger for auto-generating GRN number
CREATE TRIGGER auto_generate_grn_number_trigger
    BEFORE INSERT ON public.grn_header
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_grn_number();

-- Create trigger for updating timestamps
CREATE TRIGGER update_grn_header_updated_at
    BEFORE UPDATE ON public.grn_header
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle GRN inventory updates
CREATE OR REPLACE FUNCTION public.handle_grn_inventory_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    item_record RECORD;
    grn_header_record RECORD;
BEGIN
    -- Only process when GRN status changes to 'accepted'
    IF NEW.status = 'accepted' AND (OLD IS NULL OR OLD.status != 'accepted') THEN
        -- Get GRN header details
        SELECT * INTO grn_header_record FROM public.grn_header WHERE id = NEW.id;
        
        -- Process each line item
        FOR item_record IN 
            SELECT * FROM public.grn_line_items 
            WHERE grn_header_id = NEW.id AND accepted_quantity > 0
        LOOP
            -- Update product stock with accepted quantity
            UPDATE public.products 
            SET stock_quantity = stock_quantity + item_record.accepted_quantity,
                updated_at = now()
            WHERE id = item_record.product_id;
            
            -- Record inventory transaction
            PERFORM public.record_inventory_transaction(
                grn_header_record.company_id,
                'receipt'::transaction_type,
                NEW.id,
                grn_header_record.grn_number,
                item_record.product_id,
                item_record.warehouse_id,
                item_record.bin_id,
                item_record.accepted_quantity,
                item_record.unit_price,
                'GRN Receipt - ' || grn_header_record.grn_number,
                grn_header_record.created_by
            );
            
            -- Update PO line items with received quantities
            UPDATE public.purchase_order_items 
            SET received_quantity = received_quantity + item_record.received_quantity,
                pending_quantity = GREATEST(0, pending_quantity - item_record.received_quantity),
                updated_at = now()
            WHERE purchase_order_id = grn_header_record.purchase_order_id 
            AND product_id = item_record.product_id;
        END LOOP;
        
        -- Check if PO is fully received and update status
        UPDATE public.purchase_orders 
        SET status = CASE 
            WHEN NOT EXISTS (
                SELECT 1 FROM public.purchase_order_items 
                WHERE purchase_order_id = grn_header_record.purchase_order_id 
                AND pending_quantity > 0
            ) THEN 'closed'
            ELSE 'partially_received'
        END,
        updated_at = now()
        WHERE id = grn_header_record.purchase_order_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for GRN inventory updates
CREATE TRIGGER handle_grn_inventory_updates_trigger
    AFTER UPDATE ON public.grn_header
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_grn_inventory_updates();
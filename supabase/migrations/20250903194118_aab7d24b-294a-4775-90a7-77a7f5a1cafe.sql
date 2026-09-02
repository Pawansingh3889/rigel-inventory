-- Create sales invoices table
CREATE TABLE public.sales_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sales_order_id UUID REFERENCES public.sales_orders(id),
  delivery_note_number TEXT,
  customer_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  billing_address_line1 TEXT,
  billing_address_line2 TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_pin_code TEXT,
  billing_country TEXT,
  shipping_address_line1 TEXT,
  shipping_address_line2 TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_pin_code TEXT,
  shipping_country TEXT,
  same_as_billing_address BOOLEAN DEFAULT false,
  customer_po_reference TEXT,
  currency TEXT DEFAULT 'INR',
  payment_terms TEXT,
  due_date DATE,
  salesperson_id UUID,
  account_manager TEXT,
  mode_of_delivery TEXT,
  transporter TEXT,
  subtotal_amount NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  freight_charges NUMERIC DEFAULT 0,
  packing_charges NUMERIC DEFAULT 0,
  round_off NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  amount_in_words TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sales invoice items table
CREATE TABLE public.sales_invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_invoice_id UUID NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  item_code TEXT NOT NULL,
  item_description TEXT NOT NULL,
  hsn_sac_code TEXT,
  quantity_ordered INTEGER NOT NULL DEFAULT 0,
  quantity_invoiced INTEGER NOT NULL DEFAULT 0,
  backorder_quantity INTEGER NOT NULL DEFAULT 0,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_percentage NUMERIC DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  cgst_rate NUMERIC DEFAULT 0,
  cgst_amount NUMERIC DEFAULT 0,
  sgst_rate NUMERIC DEFAULT 0,
  sgst_amount NUMERIC DEFAULT 0,
  igst_rate NUMERIC DEFAULT 0,
  igst_amount NUMERIC DEFAULT 0,
  line_subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoice_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sales_invoices
CREATE POLICY "Company isolation for sales_invoices" 
ON public.sales_invoices 
FOR ALL 
USING (company_id = user_company_id());

-- Create RLS policies for sales_invoice_items
CREATE POLICY "Sales invoice items access" 
ON public.sales_invoice_items 
FOR ALL 
USING (sales_invoice_id IN (
  SELECT id FROM public.sales_invoices 
  WHERE company_id = user_company_id()
));

-- Create indexes for better performance
CREATE INDEX idx_sales_invoices_company_id ON public.sales_invoices(company_id);
CREATE INDEX idx_sales_invoices_customer_id ON public.sales_invoices(customer_id);
CREATE INDEX idx_sales_invoices_sales_order_id ON public.sales_invoices(sales_order_id);
CREATE INDEX idx_sales_invoice_items_invoice_id ON public.sales_invoice_items(sales_invoice_id);
CREATE INDEX idx_sales_invoice_items_product_id ON public.sales_invoice_items(product_id);

-- Create function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number(comp_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
    
    -- Get the next invoice counter starting from 1001
    SELECT COALESCE(MAX(
        CASE 
            WHEN si.invoice_number LIKE first_four_letters || 'INV%' AND 
                 SUBSTRING(si.invoice_number FROM LENGTH(first_four_letters || 'INV') + 1) ~ '^[0-9]+$' THEN
                CAST(SUBSTRING(si.invoice_number FROM LENGTH(first_four_letters || 'INV') + 1) AS INTEGER)
            ELSE 1000
        END
    ), 1000) + 1
    INTO counter
    FROM public.sales_invoices si
    WHERE si.company_id = comp_id;
    
    -- Ensure counter starts from 1001 minimum
    IF counter < 1001 THEN
        counter := 1001;
    END IF;
    
    -- Generate invoice number: First4LettersINV + Counter starting from 1001
    invoice_number := first_four_letters || 'INV' || counter::TEXT;
    
    RETURN invoice_number;
END;
$$;

-- Create trigger to auto-generate invoice number
CREATE OR REPLACE FUNCTION public.auto_generate_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := public.generate_invoice_number(NEW.company_id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_generate_invoice_number
    BEFORE INSERT ON public.sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_invoice_number();

-- Create function to process sales invoice inventory and status updates
CREATE OR REPLACE FUNCTION public.process_sales_invoice(p_invoice_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    invoice_record RECORD;
    item_record RECORD;
    v_items_processed INTEGER := 0;
    v_transactions_created INTEGER := 0;
    total_ordered_qty INTEGER := 0;
    total_invoiced_qty INTEGER := 0;
    new_so_status TEXT;
    error_msg TEXT;
    result JSON;
BEGIN
    -- Load invoice record
    SELECT * INTO invoice_record FROM public.sales_invoices WHERE id = p_invoice_id;
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Sales invoice not found',
            'invoice_id', p_invoice_id
        );
    END IF;

    BEGIN
        -- Only process when invoice is posted/finalized
        IF invoice_record.status NOT IN ('posted', 'finalized') THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Invoice status not eligible for processing',
                'status', invoice_record.status,
                'invoice_number', invoice_record.invoice_number
            );
        END IF;

        -- Process each invoice item
        FOR item_record IN 
            SELECT * FROM public.sales_invoice_items WHERE sales_invoice_id = p_invoice_id
        LOOP
            v_items_processed := v_items_processed + 1;
            
            -- Update product stock (reduce by invoiced quantity)
            UPDATE public.products 
            SET stock_quantity = stock_quantity - item_record.quantity_invoiced,
                updated_at = now()
            WHERE id = item_record.product_id;

            -- Record inventory transaction for sales invoice
            PERFORM public.record_inventory_transaction(
                invoice_record.company_id,
                'sales_invoice'::transaction_type,
                invoice_record.id,
                invoice_record.invoice_number,
                item_record.product_id,
                NULL, -- warehouse_id (to be added if needed)
                NULL, -- bin_id (to be added if needed)
                -item_record.quantity_invoiced, -- negative for sales
                item_record.unit_price,
                'Sales Invoice - ' || invoice_record.invoice_number,
                invoice_record.created_by
            );
            
            v_transactions_created := v_transactions_created + 1;
        END LOOP;

        -- Update sales order status if linked
        IF invoice_record.sales_order_id IS NOT NULL THEN
            -- Get total ordered and invoiced quantities for this sales order
            SELECT 
                COALESCE(SUM(soi.quantity), 0),
                COALESCE(SUM(COALESCE(sii.quantity_invoiced, 0)), 0)
            INTO total_ordered_qty, total_invoiced_qty
            FROM public.sales_order_items soi
            LEFT JOIN public.sales_invoice_items sii ON soi.product_id = sii.product_id 
                AND sii.sales_invoice_id IN (
                    SELECT id FROM public.sales_invoices 
                    WHERE sales_order_id = invoice_record.sales_order_id 
                    AND status IN ('posted', 'finalized')
                )
            WHERE soi.sales_order_id = invoice_record.sales_order_id;

            -- Determine new sales order status
            IF total_invoiced_qty = 0 THEN
                new_so_status := 'confirmed';
            ELSIF total_invoiced_qty >= total_ordered_qty THEN
                new_so_status := 'closed';
            ELSE
                new_so_status := 'partially_delivered';
            END IF;

            -- Update sales order status
            UPDATE public.sales_orders 
            SET status = new_so_status,
                updated_at = now()
            WHERE id = invoice_record.sales_order_id;
        END IF;

        result := json_build_object(
            'success', true,
            'invoice_number', invoice_record.invoice_number,
            'items_processed', v_items_processed,
            'transactions_created', v_transactions_created,
            'so_status', new_so_status
        );

    EXCEPTION WHEN OTHERS THEN
        error_msg := SQLERRM;
        result := json_build_object(
            'success', false,
            'error', error_msg,
            'invoice_number', invoice_record.invoice_number,
            'items_processed', v_items_processed,
            'transactions_created', v_transactions_created
        );
    END;

    RETURN result;
END;
$$;

-- Create trigger to process invoice when status changes to posted/finalized
CREATE OR REPLACE FUNCTION public.handle_sales_invoice_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
BEGIN
    -- Process invoice when status changes to posted/finalized
    IF (TG_OP = 'UPDATE' AND NEW.status IN ('posted', 'finalized') AND 
        (OLD.status IS NULL OR OLD.status NOT IN ('posted', 'finalized'))) THEN
        
        SELECT public.process_sales_invoice(NEW.id) INTO result;
        
        -- Log any failures
        IF NOT (result->>'success')::boolean THEN
            RAISE WARNING 'Sales invoice processing failed for %: %', NEW.invoice_number, result->>'error';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_process_sales_invoice_status
    AFTER UPDATE ON public.sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_sales_invoice_status_change();

-- Update inventory_transactions enum to include sales_invoice type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sales_invoice' AND enumtypid = 'transaction_type'::regtype) THEN
        ALTER TYPE transaction_type ADD VALUE 'sales_invoice';
    END IF;
END
$$;
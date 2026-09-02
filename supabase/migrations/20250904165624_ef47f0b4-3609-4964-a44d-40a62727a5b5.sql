-- Create return_order_header table
CREATE TABLE public.return_order_header (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  rso_number TEXT,
  rso_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  invoice_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  reason_for_credit TEXT NOT NULL CHECK (reason_for_credit IN ('Return', 'Price Correction', 'Discount', 'Others')),
  delivery_same_as_company BOOLEAN NOT NULL DEFAULT true,
  delivery_address_line1 TEXT,
  delivery_address_line2 TEXT,
  delivery_city TEXT,
  delivery_country TEXT,
  delivery_pin_code TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Confirmed')),
  subtotal_amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create return_order_lines table
CREATE TABLE public.return_order_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_order_id UUID NOT NULL REFERENCES public.return_order_header(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  hsn_sac_code TEXT,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  invoice_qty INTEGER NOT NULL,
  return_qty INTEGER NOT NULL DEFAULT 0,
  pending_return_qty INTEGER NOT NULL DEFAULT 0,
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

-- Create function to generate RSO number
CREATE OR REPLACE FUNCTION public.generate_rso_number(p_customer_id UUID, p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    customer_name TEXT;
    first_four_letters TEXT;
    counter INTEGER;
    rso_number TEXT;
BEGIN
    -- Get customer name
    SELECT name INTO customer_name FROM public.customers WHERE id = p_customer_id;
    
    -- Extract first 4 letters from customer name
    first_four_letters := UPPER(SUBSTRING(REGEXP_REPLACE(customer_name, '[^A-Za-z]', '', 'g') FROM 1 FOR 4));
    
    -- Ensure we have at least 4 characters, pad with 'X' if needed
    WHILE LENGTH(first_four_letters) < 4 LOOP
        first_four_letters := first_four_letters || 'X';
    END LOOP;
    
    -- Get the next RSO counter starting from 1001
    SELECT COALESCE(MAX(
        CASE 
            WHEN roh.rso_number LIKE first_four_letters || 'RSO%' AND 
                 SUBSTRING(roh.rso_number FROM LENGTH(first_four_letters || 'RSO') + 1) ~ '^[0-9]+$' THEN
                CAST(SUBSTRING(roh.rso_number FROM LENGTH(first_four_letters || 'RSO') + 1) AS INTEGER)
            ELSE 1000
        END
    ), 1000) + 1
    INTO counter
    FROM public.return_order_header roh
    WHERE roh.company_id = p_company_id;
    
    -- Ensure counter starts from 1001 minimum
    IF counter < 1001 THEN
        counter := 1001;
    END IF;
    
    -- Generate RSO number: First4LettersRSO + Counter starting from 1001
    rso_number := first_four_letters || 'RSO' || counter::TEXT;
    
    RETURN rso_number;
END;
$$;

-- Create function to auto-generate RSO number on insert
CREATE OR REPLACE FUNCTION public.auto_generate_rso_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.rso_number IS NULL OR NEW.rso_number = '' THEN
        NEW.rso_number := public.generate_rso_number(NEW.customer_id, NEW.company_id);
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger for auto-generation of RSO number
CREATE TRIGGER trigger_auto_generate_rso_number
    BEFORE INSERT ON public.return_order_header
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_rso_number();

-- Create RPC function to create return order
CREATE OR REPLACE FUNCTION public.create_return_order(
    p_company_id UUID,
    p_customer_id UUID,
    p_invoice_id UUID,
    p_reason_for_credit TEXT,
    p_delivery_same_as_company BOOLEAN DEFAULT true,
    p_delivery_address_line1 TEXT DEFAULT NULL,
    p_delivery_address_line2 TEXT DEFAULT NULL,
    p_delivery_city TEXT DEFAULT NULL,
    p_delivery_country TEXT DEFAULT NULL,
    p_delivery_pin_code TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_return_lines JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_return_order_id UUID;
    v_customer_name TEXT;
    v_invoice_number TEXT;
    v_invoice_date DATE;
    line_item JSONB;
    v_subtotal NUMERIC := 0;
    v_tax_amount NUMERIC := 0;
    v_total_amount NUMERIC := 0;
BEGIN
    -- Get customer and invoice details
    SELECT c.name INTO v_customer_name FROM public.customers c WHERE c.id = p_customer_id;
    SELECT si.invoice_number, si.invoice_date INTO v_invoice_number, v_invoice_date 
    FROM public.sales_invoices si WHERE si.id = p_invoice_id;
    
    -- Create return order header
    INSERT INTO public.return_order_header (
        company_id,
        customer_id,
        customer_name,
        invoice_id,
        invoice_number,
        invoice_date,
        reason_for_credit,
        delivery_same_as_company,
        delivery_address_line1,
        delivery_address_line2,
        delivery_city,
        delivery_country,
        delivery_pin_code,
        notes,
        created_by
    ) VALUES (
        p_company_id,
        p_customer_id,
        v_customer_name,
        p_invoice_id,
        v_invoice_number,
        v_invoice_date,
        p_reason_for_credit,
        p_delivery_same_as_company,
        p_delivery_address_line1,
        p_delivery_address_line2,
        p_delivery_city,
        p_delivery_country,
        p_delivery_pin_code,
        p_notes,
        auth.uid()
    ) RETURNING id INTO v_return_order_id;
    
    -- Process return lines
    FOR line_item IN SELECT * FROM jsonb_array_elements(p_return_lines)
    LOOP
        IF (line_item->>'return_qty')::INTEGER > 0 THEN
            INSERT INTO public.return_order_lines (
                return_order_id,
                product_id,
                product_name,
                product_sku,
                hsn_sac_code,
                unit_of_measure,
                invoice_qty,
                return_qty,
                pending_return_qty,
                unit_price,
                discount_percentage,
                discount_amount,
                cgst_rate,
                cgst_amount,
                sgst_rate,
                sgst_amount,
                igst_rate,
                igst_amount,
                line_subtotal,
                tax_amount,
                line_total
            ) VALUES (
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
                COALESCE((line_item->>'discount_percentage')::NUMERIC, 0),
                (line_item->>'discount_amount')::NUMERIC,
                COALESCE((line_item->>'cgst_rate')::NUMERIC, 0),
                (line_item->>'cgst_amount')::NUMERIC,
                COALESCE((line_item->>'sgst_rate')::NUMERIC, 0),
                (line_item->>'sgst_amount')::NUMERIC,
                COALESCE((line_item->>'igst_rate')::NUMERIC, 0),
                (line_item->>'igst_amount')::NUMERIC,
                (line_item->>'line_subtotal')::NUMERIC,
                (line_item->>'tax_amount')::NUMERIC,
                (line_item->>'line_total')::NUMERIC
            );
            
            -- Add to totals
            v_subtotal := v_subtotal + (line_item->>'line_subtotal')::NUMERIC;
            v_tax_amount := v_tax_amount + (line_item->>'tax_amount')::NUMERIC;
            v_total_amount := v_total_amount + (line_item->>'line_total')::NUMERIC;
        END IF;
    END LOOP;
    
    -- Update header totals
    UPDATE public.return_order_header 
    SET subtotal_amount = v_subtotal,
        tax_amount = v_tax_amount,
        total_amount = v_total_amount,
        updated_at = now()
    WHERE id = v_return_order_id;
    
    RETURN json_build_object(
        'success', true,
        'return_order_id', v_return_order_id,
        'rso_number', (SELECT rso_number FROM public.return_order_header WHERE id = v_return_order_id)
    );
END;
$$;

-- Create RPC function to confirm return order
CREATE OR REPLACE FUNCTION public.confirm_return_order(p_return_order_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_return_order RECORD;
    line_item RECORD;
    v_items_processed INTEGER := 0;
    v_transactions_created INTEGER := 0;
BEGIN
    -- Get return order details
    SELECT * INTO v_return_order FROM public.return_order_header WHERE id = p_return_order_id;
    
    -- Check if already confirmed
    IF v_return_order.status = 'Confirmed' THEN
        RETURN json_build_object('success', false, 'error', 'Return order already confirmed');
    END IF;
    
    -- Process each return line
    FOR line_item IN 
        SELECT * FROM public.return_order_lines WHERE return_order_id = p_return_order_id AND return_qty > 0
    LOOP
        v_items_processed := v_items_processed + 1;
        
        -- Update product stock (increase by return quantity)
        UPDATE public.products 
        SET stock_quantity = stock_quantity + line_item.return_qty,
            updated_at = now()
        WHERE id = line_item.product_id;
        
        -- Record inventory transaction for return
        PERFORM public.record_inventory_transaction(
            v_return_order.company_id,
            'sales_return'::transaction_type,
            v_return_order.id,
            v_return_order.rso_number,
            line_item.product_id,
            NULL, -- warehouse_id
            NULL, -- bin_id  
            line_item.return_qty, -- positive for returns (increases stock)
            line_item.unit_price,
            'Sales Return - ' || v_return_order.rso_number,
            v_return_order.created_by
        );
        
        v_transactions_created := v_transactions_created + 1;
    END LOOP;
    
    -- Update return order status
    UPDATE public.return_order_header 
    SET status = 'Confirmed',
        updated_at = now()
    WHERE id = p_return_order_id;
    
    RETURN json_build_object(
        'success', true,
        'rso_number', v_return_order.rso_number,
        'items_processed', v_items_processed,
        'transactions_created', v_transactions_created
    );
END;
$$;

-- Enable Row Level Security
ALTER TABLE public.return_order_header ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_order_lines ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Company isolation for return_order_header" 
ON public.return_order_header 
FOR ALL 
USING (company_id = user_company_id());

CREATE POLICY "Return order lines access" 
ON public.return_order_lines 
FOR ALL 
USING (return_order_id IN (
    SELECT id FROM public.return_order_header WHERE company_id = user_company_id()
));

-- Add sales_return to transaction_type enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
        -- Create the enum if it doesn't exist (fallback)
        CREATE TYPE transaction_type AS ENUM ('purchase_receipt', 'sales_invoice', 'adjustment', 'transfer_out', 'transfer_in', 'sales_return');
    ELSE
        -- Add sales_return to existing enum
        ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'sales_return';
    END IF;
END$$;

-- Create updated_at trigger
CREATE TRIGGER set_updated_at_return_order_header
    BEFORE UPDATE ON public.return_order_header
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();
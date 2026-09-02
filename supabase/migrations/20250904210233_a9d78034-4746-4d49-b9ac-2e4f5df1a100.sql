-- Create credit_notes table
CREATE TABLE public.credit_notes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL,
    cn_number TEXT,
    cn_date DATE NOT NULL DEFAULT CURRENT_DATE,
    rso_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft',
    default_warehouse_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    customer_name TEXT NOT NULL,
    subtotal_amount NUMERIC NOT NULL DEFAULT 0,
    discount_amount NUMERIC NOT NULL DEFAULT 0,
    tax_amount NUMERIC NOT NULL DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    amount_in_words TEXT,
    notes TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create credit_note_items table
CREATE TABLE public.credit_note_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    credit_note_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_name TEXT NOT NULL,
    product_sku TEXT NOT NULL,
    hsn_sac_code TEXT,
    unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
    rso_qty INTEGER NOT NULL,
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
    warehouse_id UUID NOT NULL,
    bin_id UUID,
    line_subtotal NUMERIC NOT NULL DEFAULT 0,
    tax_amount NUMERIC NOT NULL DEFAULT 0,
    line_total NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE public.credit_notes ADD CONSTRAINT fk_credit_notes_company FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.credit_notes ADD CONSTRAINT fk_credit_notes_rso FOREIGN KEY (rso_id) REFERENCES public.return_order_header(id);
ALTER TABLE public.credit_notes ADD CONSTRAINT fk_credit_notes_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id);
ALTER TABLE public.credit_notes ADD CONSTRAINT fk_credit_notes_warehouse FOREIGN KEY (default_warehouse_id) REFERENCES public.warehouse_bins(id);

ALTER TABLE public.credit_note_items ADD CONSTRAINT fk_credit_note_items_credit_note FOREIGN KEY (credit_note_id) REFERENCES public.credit_notes(id) ON DELETE CASCADE;
ALTER TABLE public.credit_note_items ADD CONSTRAINT fk_credit_note_items_product FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.credit_note_items ADD CONSTRAINT fk_credit_note_items_warehouse FOREIGN KEY (warehouse_id) REFERENCES public.warehouse_bins(id);
ALTER TABLE public.credit_note_items ADD CONSTRAINT fk_credit_note_items_bin FOREIGN KEY (bin_id) REFERENCES public.warehouse_bins(id);

-- Enable Row Level Security
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for credit_notes
CREATE POLICY "Company isolation for credit_notes" 
ON public.credit_notes 
FOR ALL 
USING (company_id = user_company_id());

-- Create RLS policies for credit_note_items
CREATE POLICY "Credit note items access" 
ON public.credit_note_items 
FOR ALL 
USING (credit_note_id IN (
    SELECT id FROM public.credit_notes WHERE company_id = user_company_id()
));

-- Create function to generate CN number
CREATE OR REPLACE FUNCTION public.generate_cn_number(comp_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    company_name TEXT;
    first_four_letters TEXT;
    counter INTEGER;
    cn_number TEXT;
BEGIN
    -- Get company name
    SELECT name INTO company_name FROM public.companies WHERE id = comp_id;
    
    -- Extract first 4 letters from company name
    first_four_letters := UPPER(SUBSTRING(REGEXP_REPLACE(company_name, '[^A-Za-z]', '', 'g') FROM 1 FOR 4));
    
    -- Ensure we have at least 4 characters, pad with 'X' if needed
    WHILE LENGTH(first_four_letters) < 4 LOOP
        first_four_letters := first_four_letters || 'X';
    END LOOP;
    
    -- Get the next CN counter starting from 10001
    SELECT COALESCE(MAX(
        CASE 
            WHEN cn.cn_number LIKE first_four_letters || '-CN-%' AND 
                 SUBSTRING(cn.cn_number FROM LENGTH(first_four_letters || '-CN-') + 1 FOR LENGTH(cn.cn_number) - LENGTH(first_four_letters || '-CN-') - 1) ~ '^[0-9]+$' THEN
                CAST(SUBSTRING(cn.cn_number FROM LENGTH(first_four_letters || '-CN-') + 1 FOR LENGTH(cn.cn_number) - LENGTH(first_four_letters || '-CN-') - 1) AS INTEGER)
            ELSE 10000
        END
    ), 10000) + 1
    INTO counter
    FROM public.credit_notes cn
    WHERE cn.company_id = comp_id;
    
    -- Ensure counter starts from 10001 minimum
    IF counter < 10001 THEN
        counter := 10001;
    END IF;
    
    -- Generate CN number: First4Letters-CN-Counter+S
    cn_number := first_four_letters || '-CN-' || counter::TEXT || 'S';
    
    RETURN cn_number;
END;
$$;

-- Create trigger to auto-generate CN number when status is confirmed
CREATE OR REPLACE FUNCTION public.auto_generate_cn_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Only generate CN number when status is 'Confirmed' and no number exists
    IF NEW.status = 'Confirmed' AND (NEW.cn_number IS NULL OR NEW.cn_number = '') THEN
        NEW.cn_number := public.generate_cn_number(NEW.company_id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_cn_number
    BEFORE INSERT OR UPDATE ON public.credit_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_cn_number();

-- Create function to process credit note inventory when confirmed
CREATE OR REPLACE FUNCTION public.process_credit_note_inventory(p_credit_note_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    cn_record RECORD;
    item_record RECORD;
    v_items_processed INTEGER := 0;
    v_transactions_created INTEGER := 0;
    result JSON;
    error_msg TEXT;
BEGIN
    -- Load credit note record
    SELECT * INTO cn_record FROM public.credit_notes WHERE id = p_credit_note_id;
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Credit note not found',
            'credit_note_id', p_credit_note_id
        );
    END IF;

    BEGIN
        -- Only process when credit note is confirmed
        IF cn_record.status NOT IN ('Confirmed') THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Credit note status not eligible for processing',
                'status', cn_record.status,
                'cn_number', cn_record.cn_number
            );
        END IF;

        -- Process each credit note item
        FOR item_record IN 
            SELECT * FROM public.credit_note_items WHERE credit_note_id = p_credit_note_id
        LOOP
            v_items_processed := v_items_processed + 1;
            
            -- Update product stock (add back returned quantity)
            UPDATE public.products 
            SET stock_quantity = stock_quantity + item_record.return_qty,
                updated_at = now()
            WHERE id = item_record.product_id;

            -- Record inventory transaction for credit note
            PERFORM public.record_inventory_transaction(
                cn_record.company_id,
                'credit_note'::transaction_type,
                cn_record.id,
                cn_record.cn_number,
                item_record.product_id,
                item_record.warehouse_id,
                item_record.bin_id,
                item_record.return_qty, -- positive for returns
                item_record.unit_price,
                'Credit Note - ' || cn_record.cn_number,
                NULL -- created_by: use session user
            );
            
            v_transactions_created := v_transactions_created + 1;
        END LOOP;

        result := json_build_object(
            'success', true,
            'cn_number', cn_record.cn_number,
            'items_processed', v_items_processed,
            'transactions_created', v_transactions_created
        );

    EXCEPTION WHEN OTHERS THEN
        error_msg := SQLERRM;
        result := json_build_object(
            'success', false,
            'error', error_msg,
            'cn_number', cn_record.cn_number,
            'items_processed', v_items_processed,
            'transactions_created', v_transactions_created
        );
    END;

    RETURN result;
END;
$$;

-- Create trigger to handle credit note status changes
CREATE OR REPLACE FUNCTION public.handle_credit_note_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    result JSON;
BEGIN
    -- Process inventory when status changes to confirmed
    IF (TG_OP = 'UPDATE' AND NEW.status = 'Confirmed' AND 
        (OLD.status IS NULL OR OLD.status != 'Confirmed')) THEN
        
        SELECT public.process_credit_note_inventory(NEW.id) INTO result;
        
        -- Log any failures
        IF NOT (result->>'success')::boolean THEN
            RAISE WARNING 'Credit note processing failed for %: %', NEW.cn_number, result->>'error';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_handle_credit_note_status_change
    AFTER INSERT OR UPDATE ON public.credit_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_credit_note_status_change();

-- Add updated_at trigger for credit_notes
CREATE TRIGGER set_timestamp_credit_notes
    BEFORE UPDATE ON public.credit_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Create view for credit note statistics
CREATE OR REPLACE VIEW public.credit_note_stats AS
SELECT 
    company_id,
    COUNT(CASE WHEN status = 'Draft' THEN 1 END) as draft_count,
    COALESCE(SUM(CASE WHEN status = 'Draft' THEN total_amount ELSE 0 END), 0) as draft_amount,
    COUNT(CASE WHEN status = 'Confirmed' THEN 1 END) as confirmed_count,
    COALESCE(SUM(CASE WHEN status = 'Confirmed' THEN total_amount ELSE 0 END), 0) as confirmed_amount
FROM public.credit_notes
GROUP BY company_id;
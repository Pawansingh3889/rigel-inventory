-- Create transaction type enum
CREATE TYPE transaction_type AS ENUM (
  'purchase_receipt',
  'sales_issue', 
  'adjustment_positive',
  'adjustment_negative',
  'transfer_out',
  'transfer_in'
);

-- Create inventory_transactions table
CREATE TABLE public.inventory_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  transaction_type transaction_type NOT NULL,
  reference_id UUID,
  reference_number TEXT,
  product_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  bin_id UUID,
  quantity_change INTEGER NOT NULL,
  unit_cost NUMERIC DEFAULT 0,
  total_value NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Company isolation for inventory_transactions" 
ON public.inventory_transactions 
FOR ALL 
USING (company_id = user_company_id());

-- Create indexes for performance
CREATE INDEX idx_inventory_transactions_company_product ON public.inventory_transactions(company_id, product_id);
CREATE INDEX idx_inventory_transactions_warehouse ON public.inventory_transactions(warehouse_id);
CREATE INDEX idx_inventory_transactions_date ON public.inventory_transactions(transaction_date);
CREATE INDEX idx_inventory_transactions_type ON public.inventory_transactions(transaction_type);

-- Create view for current stock levels (SOH)
CREATE VIEW public.current_stock_levels AS
SELECT 
    company_id,
    product_id,
    warehouse_id,
    bin_id,
    SUM(quantity_change) as current_stock,
    MAX(transaction_date) as last_transaction_date,
    COUNT(*) as transaction_count
FROM public.inventory_transactions 
GROUP BY company_id, product_id, warehouse_id, bin_id;

-- Create trigger for updated_at
CREATE TRIGGER update_inventory_transactions_updated_at
    BEFORE UPDATE ON public.inventory_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to record inventory transaction
CREATE OR REPLACE FUNCTION public.record_inventory_transaction(
    p_company_id UUID,
    p_transaction_type transaction_type,
    p_reference_id UUID,
    p_reference_number TEXT,
    p_product_id UUID,
    p_warehouse_id UUID,
    p_bin_id UUID,
    p_quantity_change INTEGER,
    p_unit_cost NUMERIC DEFAULT 0,
    p_notes TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
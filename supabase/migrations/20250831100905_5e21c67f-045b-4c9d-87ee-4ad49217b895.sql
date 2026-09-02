-- Create stock_transfers table
CREATE TABLE public.stock_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  product_id UUID NOT NULL,
  from_warehouse_id UUID NOT NULL,
  from_bin_id UUID NOT NULL,
  to_warehouse_id UUID NOT NULL,
  to_bin_id UUID NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL CHECK (reason IN ('rebalancing', 'stock_movement', 'customer_return', 'other')),
  remarks TEXT,
  transfer_number TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Company isolation for stock_transfers" 
ON public.stock_transfers 
FOR ALL 
USING (company_id = user_company_id());

-- Create indexes
CREATE INDEX idx_stock_transfers_company_id ON public.stock_transfers(company_id);
CREATE INDEX idx_stock_transfers_product_id ON public.stock_transfers(product_id);
CREATE INDEX idx_stock_transfers_created_at ON public.stock_transfers(created_at);

-- Add trigger for updated_at
CREATE TRIGGER update_stock_transfers_updated_at
  BEFORE UPDATE ON public.stock_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate transfer numbers
CREATE OR REPLACE FUNCTION public.generate_transfer_number(comp_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    counter INTEGER;
    transfer_number TEXT;
BEGIN
    -- Get the next transfer counter for this company
    SELECT COALESCE(MAX(CAST(SUBSTRING(st.transfer_number FROM 4) AS INTEGER)), 0) + 1
    INTO counter
    FROM stock_transfers st
    WHERE st.company_id = comp_id 
    AND st.transfer_number LIKE 'TRF%';
    
    -- Generate transfer number
    transfer_number := 'TRF' || LPAD(counter::TEXT, 4, '0');
    
    RETURN transfer_number;
END;
$$;

-- Auto-generate transfer number trigger
CREATE OR REPLACE FUNCTION public.auto_generate_transfer_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.transfer_number IS NULL OR NEW.transfer_number = '' THEN
        NEW.transfer_number := generate_transfer_number(NEW.company_id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER auto_generate_transfer_number_trigger
  BEFORE INSERT ON public.stock_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_transfer_number();
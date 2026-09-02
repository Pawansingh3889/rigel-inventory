-- Create inventory_adjustments table
CREATE TABLE public.inventory_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouse_bins(id),
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('positive', 'negative')),
  reason TEXT NOT NULL CHECK (reason IN ('opening_balance', 'damage', 'audit', 'scrap', 'transfer', 'other')),
  adjustment_quantity INTEGER NOT NULL CHECK (adjustment_quantity > 0),
  adjustment_amount NUMERIC DEFAULT 0,
  remarks TEXT,
  current_stock_before INTEGER NOT NULL DEFAULT 0,
  current_stock_after INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Company isolation for inventory_adjustments" 
ON public.inventory_adjustments 
FOR ALL 
USING (company_id = user_company_id());

-- Create index for better performance
CREATE INDEX idx_inventory_adjustments_company_product ON public.inventory_adjustments(company_id, product_id);
CREATE INDEX idx_inventory_adjustments_warehouse ON public.inventory_adjustments(warehouse_id);

-- Create function to update product stock after adjustment
CREATE OR REPLACE FUNCTION public.update_product_stock_on_adjustment()
RETURNS TRIGGER AS $$
BEGIN
  -- Update product stock quantity based on adjustment
  IF NEW.adjustment_type = 'positive' THEN
    UPDATE public.products 
    SET stock_quantity = stock_quantity + NEW.adjustment_quantity,
        updated_at = now()
    WHERE id = NEW.product_id;
  ELSE -- negative adjustment
    UPDATE public.products 
    SET stock_quantity = stock_quantity - NEW.adjustment_quantity,
        updated_at = now()
    WHERE id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update product stock
CREATE TRIGGER update_product_stock_trigger
AFTER INSERT ON public.inventory_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.update_product_stock_on_adjustment();

-- Add updated_at trigger
CREATE TRIGGER update_inventory_adjustments_updated_at
BEFORE UPDATE ON public.inventory_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
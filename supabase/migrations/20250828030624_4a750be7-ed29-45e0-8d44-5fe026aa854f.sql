-- Create sales order items table for line items
CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_order_id UUID NOT NULL,
  product_id UUID,
  item_description TEXT NOT NULL DEFAULT '',
  hsn_sac_code TEXT,
  quantity INTEGER NOT NULL,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  unit_price NUMERIC NOT NULL,
  discount_percentage NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  tax_percentage NUMERIC DEFAULT 0,
  cgst_rate NUMERIC DEFAULT 0,
  sgst_rate NUMERIC DEFAULT 0,
  igst_rate NUMERIC DEFAULT 0,
  cgst_amount NUMERIC DEFAULT 0,
  sgst_amount NUMERIC DEFAULT 0,
  igst_amount NUMERIC DEFAULT 0,
  line_total NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add new fields to sales_orders table
ALTER TABLE public.sales_orders 
ADD COLUMN IF NOT EXISTS customer_po_number TEXT,
ADD COLUMN IF NOT EXISTS customer_reference_no TEXT,
ADD COLUMN IF NOT EXISTS delivery_address_line1 TEXT,
ADD COLUMN IF NOT EXISTS delivery_address_line2 TEXT,
ADD COLUMN IF NOT EXISTS delivery_city TEXT,
ADD COLUMN IF NOT EXISTS delivery_state TEXT,
ADD COLUMN IF NOT EXISTS delivery_pin_code TEXT,
ADD COLUMN IF NOT EXISTS delivery_country TEXT,
ADD COLUMN IF NOT EXISTS same_as_registered_address BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS expected_delivery_date DATE,
ADD COLUMN IF NOT EXISTS mode_of_transport TEXT,
ADD COLUMN IF NOT EXISTS shipping_instructions TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS payment_terms TEXT,
ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC DEFAULT 0;

-- Create function to generate sales order number
CREATE OR REPLACE FUNCTION public.generate_so_number(comp_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    counter INTEGER;
    so_number TEXT;
BEGIN
    -- Get the next SO counter for this company
    SELECT COALESCE(MAX(CAST(SUBSTRING(so.order_number FROM 3) AS INTEGER)), 0) + 1
    INTO counter
    FROM sales_orders so
    WHERE so.company_id = comp_id 
    AND so.order_number LIKE 'SO%';
    
    -- Generate SO number
    so_number := 'SO' || LPAD(counter::TEXT, 4, '0');
    
    RETURN so_number;
END;
$function$;

-- Create trigger function to auto-generate SO number
CREATE OR REPLACE FUNCTION public.auto_generate_so_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := generate_so_number(NEW.company_id);
    END IF;
    RETURN NEW;
END;
$function$;

-- Create trigger to auto-generate SO number
DROP TRIGGER IF EXISTS generate_so_number_trigger ON public.sales_orders;
CREATE TRIGGER generate_so_number_trigger
    BEFORE INSERT ON public.sales_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_so_number();

-- Enable RLS on sales_order_items
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for sales_order_items
CREATE POLICY "Sales order items access" 
ON public.sales_order_items 
FOR ALL 
USING (
  sales_order_id IN (
    SELECT id FROM public.sales_orders 
    WHERE company_id = user_company_id()
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sales_order_items_sales_order_id ON public.sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_product_id ON public.sales_order_items(product_id);

-- Add updated_at trigger for sales_order_items
CREATE TRIGGER update_sales_order_items_updated_at
    BEFORE UPDATE ON public.sales_order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
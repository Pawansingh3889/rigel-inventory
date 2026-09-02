-- Add new columns to sales_order_items table for stock management
ALTER TABLE public.sales_order_items 
ADD COLUMN IF NOT EXISTS stock_on_hand integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ordered_quantity integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS back_order_quantity integer DEFAULT 0;

-- Create index for better performance on new columns
CREATE INDEX IF NOT EXISTS idx_sales_order_items_ordered_qty ON public.sales_order_items(ordered_quantity);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_back_order_qty ON public.sales_order_items(back_order_quantity);
-- Add missing fields to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS payment_terms text;

-- Add missing fields to purchase_order_items table  
ALTER TABLE public.purchase_order_items
ADD COLUMN IF NOT EXISTS pending_quantity integer DEFAULT 0;
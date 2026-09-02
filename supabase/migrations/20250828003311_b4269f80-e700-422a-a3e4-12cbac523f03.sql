-- Add same_as_registered_address flag to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS same_as_registered_address BOOLEAN DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.purchase_orders.same_as_registered_address IS 'Flag indicating if delivery address is same as company registered address';
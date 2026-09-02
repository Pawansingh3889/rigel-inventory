-- Add delivery address fields to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS delivery_address_line1 TEXT,
ADD COLUMN IF NOT EXISTS delivery_address_line2 TEXT,
ADD COLUMN IF NOT EXISTS delivery_city TEXT,
ADD COLUMN IF NOT EXISTS delivery_state TEXT,
ADD COLUMN IF NOT EXISTS delivery_country TEXT,
ADD COLUMN IF NOT EXISTS delivery_postal_code TEXT;

-- Add comments for clarity
COMMENT ON COLUMN public.purchase_orders.delivery_address_line1 IS 'First line of delivery address';
COMMENT ON COLUMN public.purchase_orders.delivery_address_line2 IS 'Second line of delivery address';
COMMENT ON COLUMN public.purchase_orders.delivery_city IS 'Delivery city';
COMMENT ON COLUMN public.purchase_orders.delivery_state IS 'Delivery state/province';
COMMENT ON COLUMN public.purchase_orders.delivery_country IS 'Delivery country';
COMMENT ON COLUMN public.purchase_orders.delivery_postal_code IS 'Delivery postal/zip code';
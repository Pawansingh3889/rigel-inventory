-- Add new fields to products table
ALTER TABLE public.products 
ADD COLUMN product_type text CHECK (product_type IN ('goods', 'service')) DEFAULT 'goods',
ADD COLUMN product_category text CHECK (product_category IN ('raw_material', 'finished_goods', 'consumables', 'assets')) DEFAULT 'raw_material';

-- Remove the warehouse bin related fields since they're being removed from UI
-- Note: Keeping them in DB for data integrity, but they won't be used in the form
-- ALTER TABLE public.products DROP COLUMN wh_bin_code;
-- ALTER TABLE public.products DROP COLUMN bin_name;

-- Update existing products to have default values
UPDATE public.products 
SET product_type = 'goods', product_category = 'raw_material' 
WHERE product_type IS NULL OR product_category IS NULL;
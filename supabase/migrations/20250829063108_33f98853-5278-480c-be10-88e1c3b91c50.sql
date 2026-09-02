-- Add warehouse bin fields to products table
ALTER TABLE public.products 
ADD COLUMN wh_bin_code TEXT,
ADD COLUMN bin_name TEXT;

-- Add foreign key constraint to ensure data integrity
ALTER TABLE public.products 
ADD CONSTRAINT fk_products_warehouse_bin 
FOREIGN KEY (wh_bin_code) REFERENCES public.warehouse_bins(wh_bin_code);
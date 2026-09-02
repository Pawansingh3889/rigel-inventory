-- Add unique constraint to wh_bin_code in warehouse_bins table
ALTER TABLE public.warehouse_bins 
ADD CONSTRAINT uk_warehouse_bins_wh_bin_code UNIQUE (wh_bin_code);

-- Add warehouse bin fields to products table
ALTER TABLE public.products 
ADD COLUMN wh_bin_code TEXT,
ADD COLUMN bin_name TEXT;

-- Add foreign key constraint to ensure data integrity
ALTER TABLE public.products 
ADD CONSTRAINT fk_products_warehouse_bin 
FOREIGN KEY (wh_bin_code) REFERENCES public.warehouse_bins(wh_bin_code);
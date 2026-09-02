-- Remove dimension_lbh and add separate dimension fields
ALTER TABLE public.products 
DROP COLUMN IF EXISTS dimension_lbh,
ADD COLUMN length_cm numeric(10,2),
ADD COLUMN width_cm numeric(10,2),
ADD COLUMN height_cm numeric(10,2);
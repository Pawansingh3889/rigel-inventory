-- Add weight and dimension fields to products table
ALTER TABLE public.products 
ADD COLUMN weight_kg numeric(10,3),
ADD COLUMN dimension_lbh text;
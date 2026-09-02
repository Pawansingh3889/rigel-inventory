-- Add missing fields to products table for enhanced inventory management
ALTER TABLE public.products 
ADD COLUMN unit text,
ADD COLUMN hsn_code text,
ADD COLUMN gst_percentage numeric(5,2) DEFAULT 0;
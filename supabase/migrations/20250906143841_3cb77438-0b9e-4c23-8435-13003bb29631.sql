-- Add new columns to products table for enhanced product management
ALTER TABLE public.products 
ADD COLUMN mrp numeric DEFAULT NULL,
ADD COLUMN volume_cubic_cm numeric DEFAULT NULL,
ADD COLUMN barcode text DEFAULT NULL,
ADD COLUMN is_taxable boolean DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN public.products.mrp IS 'Maximum Retail Price (optional)';
COMMENT ON COLUMN public.products.volume_cubic_cm IS 'Auto-calculated volume from L×W×H in cubic cm';
COMMENT ON COLUMN public.products.barcode IS 'Product barcode (optional)';
COMMENT ON COLUMN public.products.is_taxable IS 'Whether the product is taxable or not';
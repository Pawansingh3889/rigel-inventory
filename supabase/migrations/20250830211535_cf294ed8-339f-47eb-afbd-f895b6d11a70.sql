-- Add warehouse management fields to warehouse_bins table
ALTER TABLE public.warehouse_bins 
ADD COLUMN warehouse_name TEXT,
ADD COLUMN warehouse_code TEXT,
ADD COLUMN address_line1 TEXT,
ADD COLUMN address_line2 TEXT,
ADD COLUMN city TEXT,
ADD COLUMN state TEXT,
ADD COLUMN country TEXT,
ADD COLUMN postal_code TEXT,
ADD COLUMN contact_person_name TEXT,
ADD COLUMN contact_person_phone TEXT;

-- Add indexes for better performance
CREATE INDEX idx_warehouse_bins_warehouse_code ON public.warehouse_bins(warehouse_code);
CREATE INDEX idx_warehouse_bins_warehouse_name ON public.warehouse_bins(warehouse_name);

-- Update existing records to have warehouse_name from bin_name for consistency
UPDATE public.warehouse_bins 
SET warehouse_name = COALESCE(bin_name, 'Warehouse ' || wh_bin_code)
WHERE warehouse_name IS NULL;
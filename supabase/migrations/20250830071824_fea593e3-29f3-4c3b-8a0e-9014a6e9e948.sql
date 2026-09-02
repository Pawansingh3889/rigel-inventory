-- First, drop the foreign key constraint that depends on the unique constraint
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS fk_products_warehouse_bin;

-- Drop the existing unique constraint that doesn't consider company_id
ALTER TABLE public.warehouse_bins DROP CONSTRAINT IF EXISTS uk_warehouse_bins_wh_bin_code;

-- Add a new unique constraint that includes both company_id and wh_bin_code
ALTER TABLE public.warehouse_bins ADD CONSTRAINT uk_warehouse_bins_company_wh_bin_code UNIQUE (company_id, wh_bin_code);

-- Recreate the foreign key constraint if it was referencing the old constraint
-- Note: This may not be needed if the foreign key was just referencing the unique index
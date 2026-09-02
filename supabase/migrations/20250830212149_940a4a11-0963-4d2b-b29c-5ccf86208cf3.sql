-- Drop the existing unique constraint that prevents same bin codes across warehouses
ALTER TABLE public.warehouse_bins DROP CONSTRAINT IF EXISTS warehouse_bins_unique_company_code;

-- Create a new unique constraint that allows same bin codes in different warehouses
-- This ensures uniqueness of bin_code only within the same warehouse (same warehouse_name and warehouse_code)
ALTER TABLE public.warehouse_bins 
ADD CONSTRAINT warehouse_bins_unique_warehouse_bin 
UNIQUE (company_id, warehouse_name, warehouse_code, wh_bin_code);

-- Also ensure warehouse name and code combinations are unique per company
ALTER TABLE public.warehouse_bins 
ADD CONSTRAINT warehouse_bins_unique_warehouse 
UNIQUE (company_id, warehouse_name, warehouse_code);
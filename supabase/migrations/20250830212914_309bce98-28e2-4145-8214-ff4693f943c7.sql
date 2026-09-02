-- Remove the old constraint that prevents same bin codes across different warehouses
ALTER TABLE public.warehouse_bins DROP CONSTRAINT IF EXISTS uk_warehouse_bins_company_wh_bin_code;

-- Keep only the constraint that prevents duplicates within the same warehouse
-- This allows same BIN codes in different warehouses but prevents duplicates within same warehouse
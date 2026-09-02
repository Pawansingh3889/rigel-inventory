-- Add missing columns to sales_order_items to support UI fields
ALTER TABLE public.sales_order_items
  ADD COLUMN IF NOT EXISTS item_description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hsn_sac_code TEXT,
  ADD COLUMN IF NOT EXISTS unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_percentage NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cgst_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount NUMERIC DEFAULT 0;

-- Optional: ensure numeric columns are not null by defaulting to 0
UPDATE public.sales_order_items
SET 
  discount_percentage = COALESCE(discount_percentage, 0),
  tax_percentage = COALESCE(tax_percentage, 0),
  cgst_rate = COALESCE(cgst_rate, 0),
  sgst_rate = COALESCE(sgst_rate, 0),
  igst_rate = COALESCE(igst_rate, 0),
  cgst_amount = COALESCE(cgst_amount, 0),
  sgst_amount = COALESCE(sgst_amount, 0),
  igst_amount = COALESCE(igst_amount, 0)
WHERE true;
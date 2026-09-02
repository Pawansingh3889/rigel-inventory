-- Add default_warehouse_id to sales_invoices table  
-- Since there's no warehouses table, we'll make it nullable for now

-- 1) Add column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_invoices'
      AND column_name = 'default_warehouse_id'
  ) THEN
    ALTER TABLE public.sales_invoices
      ADD COLUMN default_warehouse_id uuid;
  END IF;
END $$;

-- 2) Helpful index for filters/joins
CREATE INDEX IF NOT EXISTS idx_sales_invoices_default_warehouse_id
  ON public.sales_invoices(default_warehouse_id);
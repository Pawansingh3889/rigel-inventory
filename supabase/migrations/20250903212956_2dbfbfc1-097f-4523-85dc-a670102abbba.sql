-- Add default_warehouse_id to sales_invoices to match UI payload
-- Safe migration: only add if missing, then add FK and index

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

-- 2) Add foreign key to warehouses(id) if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_sales_invoices_default_warehouse'
  ) THEN
    ALTER TABLE public.sales_invoices
      ADD CONSTRAINT fk_sales_invoices_default_warehouse
      FOREIGN KEY (default_warehouse_id)
      REFERENCES public.warehouses(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Helpful index for filters/joins
CREATE INDEX IF NOT EXISTS idx_sales_invoices_default_warehouse_id
  ON public.sales_invoices(default_warehouse_id);

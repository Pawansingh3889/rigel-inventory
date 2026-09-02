
-- 1) Add missing columns on sales_orders
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS default_warehouse_id uuid,
  ADD COLUMN IF NOT EXISTS default_bin_id uuid;

-- 2) Add foreign keys to warehouse_bins (safe: set NULL on delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sales_orders_default_warehouse_fk'
  ) THEN
    ALTER TABLE public.sales_orders
      ADD CONSTRAINT sales_orders_default_warehouse_fk
      FOREIGN KEY (default_warehouse_id)
      REFERENCES public.warehouse_bins (id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sales_orders_default_bin_fk'
  ) THEN
    ALTER TABLE public.sales_orders
      ADD CONSTRAINT sales_orders_default_bin_fk
      FOREIGN KEY (default_bin_id)
      REFERENCES public.warehouse_bins (id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Indexes for faster filtering/joins
CREATE INDEX IF NOT EXISTS idx_sales_orders_default_warehouse ON public.sales_orders (default_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_default_bin ON public.sales_orders (default_bin_id);

-- 4) Backfill header from the first sales_order_items row per order (where present)
UPDATE public.sales_orders s
SET
  default_warehouse_id = COALESCE(s.default_warehouse_id, li.warehouse_id),
  default_bin_id       = COALESCE(s.default_bin_id, li.bin_id),
  updated_at           = now()
FROM (
  SELECT DISTINCT ON (sales_order_id)
         sales_order_id, warehouse_id, bin_id
  FROM public.sales_order_items
  WHERE warehouse_id IS NOT NULL OR bin_id IS NOT NULL
  ORDER BY sales_order_id, created_at ASC
) li
WHERE s.id = li.sales_order_id
  AND (s.default_warehouse_id IS NULL OR s.default_bin_id IS NULL);

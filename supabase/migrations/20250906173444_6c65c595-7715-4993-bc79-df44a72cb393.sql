
-- 1) Extend transaction_type enum for production flows
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE transaction_type AS ENUM (
      'purchase_receipt','sales_issue','adjustment_positive','adjustment_negative','transfer_out','transfer_in',
      'sales_invoice','sales_return','production_receipt','production_consumption'
    );
  ELSE
    BEGIN
      ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'production_receipt';
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'production_consumption';
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END$$;

-- 2) BOM tables

CREATE TABLE IF NOT EXISTS public.bom_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  finished_product_id UUID NOT NULL REFERENCES public.products(id),
  bom_name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1.0',
  yield_quantity INTEGER NOT NULL DEFAULT 1,
  labor_cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  overhead_cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  material_cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  total_cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  warehouse_id UUID NULL REFERENCES public.warehouse_bins(id) ON DELETE SET NULL,
  bin_id UUID NULL REFERENCES public.warehouse_bins(id) ON DELETE SET NULL,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bom_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES public.bom_headers(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES public.products(id),
  quantity_per_unit NUMERIC NOT NULL, -- quantity needed to make 1 unit of FG
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.production_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bom_id UUID NOT NULL REFERENCES public.bom_headers(id) ON DELETE CASCADE,
  finished_product_id UUID NOT NULL REFERENCES public.products(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouse_bins(id),
  bin_id UUID NULL REFERENCES public.warehouse_bins(id),
  quantity_produced INTEGER NOT NULL,
  material_cost_total NUMERIC NOT NULL DEFAULT 0,
  labor_cost_total NUMERIC NOT NULL DEFAULT 0,
  overhead_cost_total NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_bom_headers_company ON public.bom_headers(company_id);
CREATE INDEX IF NOT EXISTS idx_bom_components_bom ON public.bom_components(bom_id);
CREATE INDEX IF NOT EXISTS idx_production_runs_company ON public.production_runs(company_id);

-- 4) RLS
ALTER TABLE public.bom_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_runs ENABLE ROW LEVEL SECURITY;

-- Company isolation policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bom_headers' AND policyname='Company isolation for bom_headers') THEN
    CREATE POLICY "Company isolation for bom_headers"
      ON public.bom_headers FOR ALL
      USING (company_id = user_company_id())
      WITH CHECK (company_id = user_company_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bom_components' AND policyname='Company isolation for bom_components') THEN
    CREATE POLICY "Company isolation for bom_components"
      ON public.bom_components FOR ALL
      USING (bom_id IN (SELECT id FROM public.bom_headers WHERE company_id = user_company_id()))
      WITH CHECK (bom_id IN (SELECT id FROM public.bom_headers WHERE company_id = user_company_id()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='production_runs' AND policyname='Company isolation for production_runs') THEN
    CREATE POLICY "Company isolation for production_runs"
      ON public.production_runs FOR ALL
      USING (company_id = user_company_id())
      WITH CHECK (company_id = user_company_id());
  END IF;
END$$;

-- 5) updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_bom_headers ON public.bom_headers;
CREATE TRIGGER set_updated_at_bom_headers
  BEFORE UPDATE ON public.bom_headers
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 6) Production RPC
CREATE OR REPLACE FUNCTION public.process_bom_production(
  p_bom_id UUID,
  p_quantity INTEGER,
  p_company_id UUID,
  p_warehouse_id UUID,
  p_bin_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hdr RECORD;
  v_cmp RECORD;
  v_fg_qty INTEGER;
  v_material_cost_total NUMERIC := 0;
  v_labor_cost_total NUMERIC := 0;
  v_overhead_cost_total NUMERIC := 0;
  v_total_cost NUMERIC := 0;
  v_run_id UUID;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Production quantity must be > 0';
  END IF;

  SELECT * INTO v_hdr
  FROM public.bom_headers
  WHERE id = p_bom_id AND company_id = p_company_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOM not found or inactive';
  END IF;

  -- Compute totals
  v_fg_qty := COALESCE(v_hdr.yield_quantity, 1) * p_quantity;
  v_labor_cost_total := COALESCE(v_hdr.labor_cost_per_unit,0) * v_fg_qty;
  v_overhead_cost_total := COALESCE(v_hdr.overhead_cost_per_unit,0) * v_fg_qty;

  -- Consume components (production_consumption)
  FOR v_cmp IN
    SELECT bc.*, p.cost_price
    FROM public.bom_components bc
    JOIN public.products p ON p.id = bc.component_product_id
    WHERE bc.bom_id = p_bom_id
  LOOP
    PERFORM public.record_inventory_transaction(
      p_company_id,
      'production_consumption'::transaction_type,
      p_bom_id,
      v_hdr.bom_name,
      v_cmp.component_product_id,
      p_warehouse_id,
      p_bin_id,
      -CEIL(v_cmp.quantity_per_unit * p_quantity),
      v_cmp.unit_cost,
      'BOM Consumption - ' || v_hdr.bom_name,
      p_created_by
    );

    -- Update product stock for components
    UPDATE public.products
    SET stock_quantity = stock_quantity - CEIL(v_cmp.quantity_per_unit * p_quantity),
        updated_at = now()
    WHERE id = v_cmp.component_product_id;

    v_material_cost_total := v_material_cost_total + (COALESCE(v_cmp.unit_cost,0) * CEIL(v_cmp.quantity_per_unit * p_quantity));
  END LOOP;

  -- Receive finished goods (production_receipt)
  PERFORM public.record_inventory_transaction(
    p_company_id,
    'production_receipt'::transaction_type,
    p_bom_id,
    v_hdr.bom_name,
    v_hdr.finished_product_id,
    p_warehouse_id,
    p_bin_id,
    v_fg_qty,
    COALESCE(v_hdr.total_cost_per_unit,0),
    'BOM Receipt - ' || v_hdr.bom_name,
    p_created_by
  );

  UPDATE public.products
  SET stock_quantity = stock_quantity + v_fg_qty,
      updated_at = now()
  WHERE id = v_hdr.finished_product_id;

  v_total_cost := v_material_cost_total + v_labor_cost_total + v_overhead_cost_total;

  INSERT INTO public.production_runs (
    company_id, bom_id, finished_product_id,
    warehouse_id, bin_id,
    quantity_produced, material_cost_total, labor_cost_total, overhead_cost_total, total_cost,
    created_by
  ) VALUES (
    p_company_id, p_bom_id, v_hdr.finished_product_id,
    p_warehouse_id, p_bin_id,
    v_fg_qty, v_material_cost_total, v_labor_cost_total, v_overhead_cost_total, v_total_cost,
    COALESCE(p_created_by, auth.uid())
  ) RETURNING id INTO v_run_id;

  RETURN json_build_object(
    'success', true,
    'production_run_id', v_run_id,
    'finished_goods_qty', v_fg_qty,
    'material_cost_total', v_material_cost_total,
    'labor_cost_total', v_labor_cost_total,
    'overhead_cost_total', v_overhead_cost_total,
    'total_cost', v_total_cost
  );
END;
$$;

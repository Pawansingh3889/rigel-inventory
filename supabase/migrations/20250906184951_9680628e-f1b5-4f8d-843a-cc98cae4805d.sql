-- Fix the process_bom_production function to use correct parameter types
CREATE OR REPLACE FUNCTION public.process_bom_production(p_bom_id uuid, p_quantity integer, p_company_id uuid, p_warehouse_id uuid, p_bin_id uuid DEFAULT NULL::uuid, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hdr RECORD;
  v_cmp RECORD;
  v_fg_qty INTEGER;
  v_material_cost_total NUMERIC := 0;
  v_labor_cost_total NUMERIC := 0;
  v_overhead_cost_total NUMERIC := 0;
  v_total_cost NUMERIC := 0;
  v_run_id UUID;
  v_component_qty INTEGER;
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
    -- Calculate component quantity as INTEGER
    v_component_qty := CEIL(v_cmp.quantity_per_unit * p_quantity)::INTEGER;
    
    PERFORM public.record_inventory_transaction(
      p_company_id,
      'production_consumption'::transaction_type,
      p_bom_id,
      v_hdr.bom_name,
      v_cmp.component_product_id,
      p_warehouse_id,
      p_bin_id,
      -v_component_qty,  -- negative integer for consumption
      v_cmp.unit_cost,
      'BOM Consumption - ' || v_hdr.bom_name,
      p_created_by
    );

    -- Update product stock for components
    UPDATE public.products
    SET stock_quantity = stock_quantity - v_component_qty,
        updated_at = now()
    WHERE id = v_cmp.component_product_id;

    v_material_cost_total := v_material_cost_total + (COALESCE(v_cmp.unit_cost,0) * v_component_qty);
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
    v_fg_qty,  -- positive integer for receipt
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
$function$
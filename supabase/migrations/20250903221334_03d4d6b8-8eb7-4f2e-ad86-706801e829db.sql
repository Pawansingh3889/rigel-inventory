-- Create function to get sales order item remaining quantities
CREATE OR REPLACE FUNCTION public.get_sales_order_item_remaining_quantities(p_sales_order_id uuid)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  product_sku text,
  quantity_ordered integer,
  quantity_already_invoiced integer,
  quantity_remaining integer,
  current_backorder_qty integer,
  unit_price numeric,
  hsn_sac_code text,
  unit_of_measure text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    soi.product_id,
    p.name as product_name,
    p.sku as product_sku,
    soi.quantity as quantity_ordered,
    COALESCE(SUM(sii.quantity_invoiced), 0)::integer as quantity_already_invoiced,
    GREATEST(0, soi.quantity - COALESCE(SUM(sii.quantity_invoiced), 0))::integer as quantity_remaining,
    soi.back_order_quantity as current_backorder_qty,
    soi.unit_price,
    soi.hsn_sac_code,
    soi.unit_of_measure
  FROM public.sales_order_items soi
  LEFT JOIN public.products p ON soi.product_id = p.id
  LEFT JOIN public.sales_invoice_items sii ON soi.product_id = sii.product_id
    AND sii.sales_invoice_id IN (
      SELECT si.id FROM public.sales_invoices si 
      WHERE si.sales_order_id = p_sales_order_id 
      AND si.status = 'finalized'
    )
  WHERE soi.sales_order_id = p_sales_order_id
  GROUP BY 
    soi.product_id, 
    p.name, 
    p.sku, 
    soi.quantity, 
    soi.back_order_quantity,
    soi.unit_price,
    soi.hsn_sac_code,
    soi.unit_of_measure
  ORDER BY soi.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;
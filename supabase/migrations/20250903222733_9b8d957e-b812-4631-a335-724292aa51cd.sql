-- Create database functions for sales metrics dashboard

-- Function to get sales metrics (pending orders and backorders)
CREATE OR REPLACE FUNCTION public.get_sales_metrics(p_company_id uuid)
RETURNS TABLE(
  pending_orders_count integer,
  pending_orders_value numeric,
  total_backorder_units integer,
  total_backorder_value numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Pending sales orders count and value
    (SELECT COUNT(*)::integer 
     FROM public.sales_orders so 
     WHERE so.company_id = p_company_id 
     AND so.status IN ('confirmed', 'draft', 'partially_delivered')) as pending_orders_count,
    
    (SELECT COALESCE(SUM(so.total_amount), 0) 
     FROM public.sales_orders so 
     WHERE so.company_id = p_company_id 
     AND so.status IN ('confirmed', 'draft', 'partially_delivered')) as pending_orders_value,
    
    -- Total backorder units and value
    (SELECT COALESCE(SUM(soi.back_order_quantity), 0)::integer 
     FROM public.sales_order_items soi
     JOIN public.sales_orders so ON soi.sales_order_id = so.id
     WHERE so.company_id = p_company_id 
     AND soi.back_order_quantity > 0) as total_backorder_units,
    
    (SELECT COALESCE(SUM(soi.back_order_quantity * soi.unit_price), 0) 
     FROM public.sales_order_items soi
     JOIN public.sales_orders so ON soi.sales_order_id = so.id
     WHERE so.company_id = p_company_id 
     AND soi.back_order_quantity > 0) as total_backorder_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Function to get top backordered items
CREATE OR REPLACE FUNCTION public.get_top_backorder_items(p_company_id uuid, p_limit integer DEFAULT 5)
RETURNS TABLE(
  product_name text,
  product_sku text,
  total_backorder_qty integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.name as product_name,
    p.sku as product_sku,
    SUM(soi.back_order_quantity)::integer as total_backorder_qty
  FROM public.sales_order_items soi
  JOIN public.products p ON soi.product_id = p.id
  JOIN public.sales_orders so ON soi.sales_order_id = so.id
  WHERE so.company_id = p_company_id 
    AND soi.back_order_quantity > 0
  GROUP BY p.id, p.name, p.sku
  ORDER BY SUM(soi.back_order_quantity) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Function to get top customers by backorder amount
CREATE OR REPLACE FUNCTION public.get_top_backorder_customers(p_company_id uuid, p_limit integer DEFAULT 5)
RETURNS TABLE(
  customer_name text,
  customer_ref text,
  total_backorder_amount numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.name as customer_name,
    c.customer_ref,
    SUM(soi.back_order_quantity * soi.unit_price) as total_backorder_amount
  FROM public.sales_order_items soi
  JOIN public.sales_orders so ON soi.sales_order_id = so.id
  JOIN public.customers c ON so.customer_id = c.id
  WHERE so.company_id = p_company_id 
    AND soi.back_order_quantity > 0
  GROUP BY c.id, c.name, c.customer_ref
  ORDER BY SUM(soi.back_order_quantity * soi.unit_price) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;
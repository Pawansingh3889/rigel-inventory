-- Update get_sales_orders_with_delivery_summary function to order by order_date DESC, created_at DESC
CREATE OR REPLACE FUNCTION public.get_sales_orders_with_delivery_summary(p_company_id uuid)
 RETURNS TABLE(id uuid, order_number text, order_date date, customer_id uuid, customer_name text, customer_ref text, customer_po_number text, status text, total_amount numeric, currency text, created_at timestamp with time zone, total_ordered_qty integer, total_invoiced_qty integer, total_backorder_qty integer, delivery_status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    so.id,
    so.order_number,
    so.order_date,
    so.customer_id,
    c.name as customer_name,
    c.customer_ref,
    so.customer_po_number,
    so.status,
    so.total_amount,
    so.currency,
    so.created_at,
    COALESCE(ds.total_ordered_qty, 0) as total_ordered_qty,
    COALESCE(ds.total_invoiced_qty, 0) as total_invoiced_qty,
    COALESCE(ds.total_backorder_qty, 0) as total_backorder_qty,
    COALESCE(ds.delivery_status, 'not_started') as delivery_status
  FROM public.sales_orders so
  LEFT JOIN public.customers c ON so.customer_id = c.id
  LEFT JOIN LATERAL public.get_sales_order_delivery_summary(so.id) ds ON true
  WHERE so.company_id = p_company_id
  ORDER BY so.order_date DESC, so.created_at DESC;
END;
$function$;
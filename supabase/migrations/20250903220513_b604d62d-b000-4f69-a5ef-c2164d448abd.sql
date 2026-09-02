-- Create function to get sales order delivery summary with quantities
CREATE OR REPLACE FUNCTION public.get_sales_order_delivery_summary(p_sales_order_id uuid)
RETURNS TABLE(
  total_ordered_qty integer,
  total_invoiced_qty integer,
  total_backorder_qty integer,
  delivery_status text
) AS $$
DECLARE
  v_total_ordered integer := 0;
  v_total_invoiced integer := 0;
  v_total_backorder integer := 0;
  v_status text := 'not_started';
BEGIN
  -- Get total ordered quantity from sales_order_items
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_total_ordered
  FROM public.sales_order_items 
  WHERE sales_order_id = p_sales_order_id;

  -- Get total invoiced quantity from sales_invoice_items for finalized invoices
  SELECT COALESCE(SUM(sii.quantity_invoiced), 0)
  INTO v_total_invoiced
  FROM public.sales_invoice_items sii
  JOIN public.sales_invoices si ON sii.sales_invoice_id = si.id
  WHERE si.sales_order_id = p_sales_order_id 
    AND si.status = 'finalized';

  -- Calculate backorder quantity
  v_total_backorder := GREATEST(0, v_total_ordered - v_total_invoiced);

  -- Determine delivery status
  IF v_total_invoiced = 0 THEN
    v_status := 'not_started';
  ELSIF v_total_invoiced >= v_total_ordered THEN
    v_status := 'closed';
  ELSE
    v_status := 'partially_delivered';
  END IF;

  RETURN QUERY SELECT v_total_ordered, v_total_invoiced, v_total_backorder, v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Create enhanced function to get sales orders with delivery summary
CREATE OR REPLACE FUNCTION public.get_sales_orders_with_delivery_summary(p_company_id uuid)
RETURNS TABLE(
  id uuid,
  order_number text,
  order_date date,
  customer_id uuid,
  customer_name text,
  customer_ref text,
  customer_po_number text,
  status text,
  total_amount numeric,
  currency text,
  created_at timestamp with time zone,
  total_ordered_qty integer,
  total_invoiced_qty integer,
  total_backorder_qty integer,
  delivery_status text
) AS $$
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
  ORDER BY so.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;
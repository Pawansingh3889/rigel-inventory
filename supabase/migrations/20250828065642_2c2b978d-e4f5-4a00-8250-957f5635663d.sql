
-- 1) Auto-generate Sales Order number on insert
DROP TRIGGER IF EXISTS before_insert_sales_orders_auto_so_num ON public.sales_orders;

CREATE TRIGGER before_insert_sales_orders_auto_so_num
BEFORE INSERT ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_so_number();

-- 2) (Optional but recommended) Auto-generate Performa Invoice number on insert
DROP TRIGGER IF EXISTS before_insert_performa_invoices_auto_num ON public.performa_invoices;

CREATE TRIGGER before_insert_performa_invoices_auto_num
BEFORE INSERT ON public.performa_invoices
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_performa_invoice_number();

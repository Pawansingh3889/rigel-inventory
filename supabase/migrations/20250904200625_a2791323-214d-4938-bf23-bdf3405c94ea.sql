-- Add composite indexes for optimal performance on commonly sorted fields
-- Sales Orders - order by order_date DESC, created_at DESC
CREATE INDEX IF NOT EXISTS idx_sales_orders_dates 
ON public.sales_orders(company_id, order_date DESC, created_at DESC);

-- Sales Invoices - order by invoice_date DESC, created_at DESC  
CREATE INDEX IF NOT EXISTS idx_sales_invoices_dates 
ON public.sales_invoices(company_id, invoice_date DESC, created_at DESC);

-- GRN Header - order by grn_date DESC, created_at DESC
CREATE INDEX IF NOT EXISTS idx_grn_header_dates 
ON public.grn_header(company_id, grn_date DESC, created_at DESC);

-- Purchase Orders - order by order_date DESC, created_at DESC
CREATE INDEX IF NOT EXISTS idx_purchase_orders_dates 
ON public.purchase_orders(company_id, order_date DESC, created_at DESC);

-- Inventory Transactions - already has correct ordering by transaction_date DESC, created_at DESC
-- Add index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_dates 
ON public.inventory_transactions(company_id, transaction_date DESC, created_at DESC);
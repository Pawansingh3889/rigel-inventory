-- Add composite indexes for optimal query performance on tables with consistent ordering
-- These indexes support the ORDER BY clauses we're using throughout the application

-- Sales Orders: order_date DESC, created_at DESC
CREATE INDEX IF NOT EXISTS idx_sales_orders_dates 
ON sales_orders(company_id, order_date DESC, created_at DESC);

-- Sales Invoices: invoice_date DESC, created_at DESC  
CREATE INDEX IF NOT EXISTS idx_sales_invoices_dates 
ON sales_invoices(company_id, invoice_date DESC, created_at DESC);

-- Purchase Orders: order_date DESC, created_at DESC
CREATE INDEX IF NOT EXISTS idx_purchase_orders_dates 
ON purchase_orders(company_id, order_date DESC, created_at DESC);

-- GRN Header: grn_date DESC, created_at DESC
CREATE INDEX IF NOT EXISTS idx_grn_header_dates 
ON grn_header(company_id, grn_date DESC, created_at DESC);

-- Inventory Transactions: transaction_date DESC, created_at DESC
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_dates 
ON inventory_transactions(company_id, transaction_date DESC, created_at DESC);

-- Master Data Tables: created_at DESC (already have single column indexes, adding composite)
CREATE INDEX IF NOT EXISTS idx_customers_company_created 
ON customers(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_suppliers_company_created 
ON suppliers(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_company_created 
ON products(company_id, created_at DESC);

-- Return Orders: created_at DESC
CREATE INDEX IF NOT EXISTS idx_return_order_header_company_created 
ON return_order_header(company_id, created_at DESC);

-- Inventory Adjustments: created_at DESC
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_company_created 
ON inventory_adjustments(company_id, created_at DESC);
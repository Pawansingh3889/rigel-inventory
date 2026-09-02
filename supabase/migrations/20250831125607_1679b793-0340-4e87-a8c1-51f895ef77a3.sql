-- Remove purchase invoice related tables and dependencies
DROP TABLE IF EXISTS public.purchase_invoice_items CASCADE;
DROP TABLE IF EXISTS public.purchase_invoices CASCADE;

-- Remove any functions that reference purchase invoices
DROP FUNCTION IF EXISTS public.generate_purchase_invoice_number(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.auto_generate_purchase_invoice_number() CASCADE;
DROP FUNCTION IF EXISTS public.update_inventory_on_purchase_invoice() CASCADE;
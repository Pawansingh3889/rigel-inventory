-- Manually trigger inventory processing for invoice RIGEINV1004 
UPDATE public.sales_invoices 
SET status = 'draft', updated_at = now() 
WHERE invoice_number = 'RIGEINV1004';

UPDATE public.sales_invoices 
SET status = 'finalized', updated_at = now() 
WHERE invoice_number = 'RIGEINV1004';
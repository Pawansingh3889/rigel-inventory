-- Make invoice_number nullable to allow draft invoices
ALTER TABLE public.sales_invoices 
ALTER COLUMN invoice_number DROP NOT NULL;

-- Add a comment to document the change
COMMENT ON COLUMN public.sales_invoices.invoice_number IS 'Invoice number - generated automatically when status changes to finalized, null for draft invoices';
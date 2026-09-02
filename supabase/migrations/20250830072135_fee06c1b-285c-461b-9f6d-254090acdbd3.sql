-- Fix suppliers table - supplier_ref should be unique per company, not globally
DROP INDEX IF EXISTS suppliers_supplier_ref_unique;
CREATE UNIQUE INDEX suppliers_company_supplier_ref_unique ON public.suppliers (company_id, supplier_ref);

-- Fix performa_invoices table - invoice numbers should be unique per company, not globally  
DROP INDEX IF EXISTS uniq_performa_invoice_number_not_null;
CREATE UNIQUE INDEX uniq_performa_invoice_number_company ON public.performa_invoices (company_id, performa_invoice_number) WHERE (performa_invoice_number IS NOT NULL);

-- Add unique constraints for purchase invoice numbers per company
CREATE UNIQUE INDEX purchase_invoices_company_number_unique ON public.purchase_invoices (company_id, purchase_invoice_number);

-- Add unique constraints for customer references per company
CREATE UNIQUE INDEX customers_company_ref_unique ON public.customers (company_id, customer_ref) WHERE (customer_ref IS NOT NULL);
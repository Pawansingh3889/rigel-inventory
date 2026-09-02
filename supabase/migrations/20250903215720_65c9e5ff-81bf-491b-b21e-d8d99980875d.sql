-- Create trigger for auto-generating invoice numbers when status changes to finalized
CREATE TRIGGER trigger_auto_generate_invoice_number
    BEFORE INSERT OR UPDATE ON public.sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_invoice_number();

-- Create trigger for processing sales invoice inventory when status changes to finalized  
CREATE TRIGGER trigger_handle_sales_invoice_status_change
    AFTER UPDATE ON public.sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_sales_invoice_status_change();

-- Add comment to document the triggers
COMMENT ON TRIGGER trigger_auto_generate_invoice_number ON public.sales_invoices IS 'Automatically generates invoice number when status changes to finalized';
COMMENT ON TRIGGER trigger_handle_sales_invoice_status_change ON public.sales_invoices IS 'Processes inventory transactions when invoice status changes to finalized';
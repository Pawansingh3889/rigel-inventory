-- Update sales invoice workflow: only draft/finalized status, generate invoice number only when finalizing

-- 1. Update the auto_generate_invoice_number trigger function to only generate for finalized status
CREATE OR REPLACE FUNCTION public.auto_generate_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Only generate invoice number when status is 'finalized' and no number exists
    IF NEW.status = 'finalized' AND (NEW.invoice_number IS NULL OR NEW.invoice_number = '') THEN
        NEW.invoice_number := public.generate_invoice_number(NEW.company_id);
    END IF;
    RETURN NEW;
END;
$function$;

-- 2. Update the sales invoice status change trigger to process inventory only on finalization
CREATE OR REPLACE FUNCTION public.handle_sales_invoice_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result JSON;
BEGIN
    -- Process invoice when status changes to finalized (from draft or any other status)
    IF (TG_OP = 'UPDATE' AND NEW.status = 'finalized' AND 
        (OLD.status IS NULL OR OLD.status != 'finalized')) THEN
        
        SELECT public.process_sales_invoice(NEW.id) INTO result;
        
        -- Log any failures
        IF NOT (result->>'success')::boolean THEN
            RAISE WARNING 'Sales invoice processing failed for %: %', NEW.invoice_number, result->>'error';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- 3. Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS trg_sales_invoice_status_change ON public.sales_invoices;
CREATE TRIGGER trg_sales_invoice_status_change
    BEFORE UPDATE ON public.sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_sales_invoice_status_change();

-- 4. Ensure the auto-generate invoice number trigger exists
DROP TRIGGER IF EXISTS trg_auto_generate_invoice_number ON public.sales_invoices;
CREATE TRIGGER trg_auto_generate_invoice_number
    BEFORE INSERT OR UPDATE ON public.sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_invoice_number();
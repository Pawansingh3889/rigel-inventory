
-- 1) Add missing place_of_supply field for invoices
ALTER TABLE public.performa_invoices
ADD COLUMN IF NOT EXISTS place_of_supply text;

-- 2) Allow drafts without invoice number
ALTER TABLE public.performa_invoices
ALTER COLUMN performa_invoice_number DROP NOT NULL;

-- 3) Company-scoped invoice number generator: INV-ABCD-001, 002, ...
CREATE OR REPLACE FUNCTION public.generate_company_invoice_number(comp_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  company_name TEXT;
  first_four TEXT;
  counter INTEGER;
  inv_no TEXT;
BEGIN
  -- Get company name
  SELECT name INTO company_name FROM public.companies WHERE id = comp_id;

  -- First 4 letters, letters only, pad with X if needed
  first_four := UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(company_name, ''), '[^A-Za-z]', '', 'g') FROM 1 FOR 4));
  WHILE LENGTH(first_four) < 4 LOOP
    first_four := first_four || 'X';
  END LOOP;

  -- Find next sequence for this company
  SELECT COALESCE(
           MAX(
             CAST(
               SUBSTRING(pi.performa_invoice_number FROM LENGTH('INV-' || first_four || '-') + 1) 
               AS INTEGER
             )
           ), 
           0
         ) + 1
  INTO counter
  FROM public.performa_invoices pi
  WHERE pi.company_id = comp_id
    AND pi.performa_invoice_number LIKE 'INV-' || first_four || '-%';

  inv_no := 'INV-' || first_four || '-' || LPAD(counter::text, 3, '0');
  RETURN inv_no;
END;
$function$;

-- 4) Trigger to set invoice fields only when status = 'invoiced'
CREATE OR REPLACE FUNCTION public.auto_set_invoice_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'invoiced' THEN
    IF NEW.performa_invoice_number IS NULL OR NEW.performa_invoice_number = '' THEN
      NEW.performa_invoice_number := public.generate_company_invoice_number(NEW.company_id);
    END IF;

    IF NEW.performa_invoice_date IS NULL THEN
      NEW.performa_invoice_date := CURRENT_DATE;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS biu_performa_invoices_invoice_fields ON public.performa_invoices;

CREATE TRIGGER biu_performa_invoices_invoice_fields
BEFORE INSERT OR UPDATE ON public.performa_invoices
FOR EACH ROW
EXECUTE FUNCTION public.auto_set_invoice_fields();

-- 5) Keep numbers unique when present (drafts with NULL allowed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname = 'uniq_performa_invoice_number_not_null'
  ) THEN
    CREATE UNIQUE INDEX uniq_performa_invoice_number_not_null
    ON public.performa_invoices (performa_invoice_number)
    WHERE performa_invoice_number IS NOT NULL;
  END IF;
END$$;

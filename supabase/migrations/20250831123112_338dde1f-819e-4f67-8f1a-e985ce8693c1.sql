-- Fix ambiguous grn_number reference and add required triggers for GRN

-- 1) Replace generate_grn_number to avoid column/variable ambiguity
CREATE OR REPLACE FUNCTION public.generate_grn_number(comp_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    company_name TEXT;
    first_four_letters TEXT;
    current_date_str TEXT;
    counter INTEGER;
    v_grn_number TEXT;
BEGIN
    -- Get company name
    SELECT name INTO company_name FROM public.companies WHERE id = comp_id;

    -- Extract first 4 letters from company name
    first_four_letters := UPPER(SUBSTRING(REGEXP_REPLACE(company_name, '[^A-Za-z]', '', 'g') FROM 1 FOR 4));

    -- Ensure we have at least 4 characters, pad with 'X' if needed
    WHILE LENGTH(first_four_letters) < 4 LOOP
        first_four_letters := first_four_letters || 'X';
    END LOOP;

    -- Get current date in MMDDYYYY format
    current_date_str := to_char(now(), 'MMDDYYYY');

    -- Use table alias to avoid ambiguity with local variables
    SELECT COALESCE(MAX(
        CASE 
            WHEN gh.grn_number LIKE first_four_letters || 'GRN' || current_date_str || '%' THEN
                CAST(SUBSTRING(gh.grn_number FROM LENGTH(first_four_letters || 'GRN' || current_date_str) + 1) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO counter
    FROM public.grn_header gh
    WHERE gh.company_id = comp_id;

    -- Generate GRN number: COMPGRN + MMDDYYYY + counter
    v_grn_number := first_four_letters || 'GRN' || current_date_str || LPAD(counter::TEXT, 3, '0');

    RETURN v_grn_number;
END;
$function$;

-- 2) Ensure trigger to auto-generate GRN number on insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_generate_grn_number'
  ) THEN
    CREATE TRIGGER trg_auto_generate_grn_number
    BEFORE INSERT ON public.grn_header
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_grn_number();
  END IF;
END
$$;

-- 3) Ensure inventory updates happen when GRN is inserted or status updated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_handle_grn_inventory_updates'
  ) THEN
    CREATE TRIGGER trg_handle_grn_inventory_updates
    AFTER INSERT OR UPDATE ON public.grn_header
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_grn_inventory_updates();
  END IF;
END
$$;
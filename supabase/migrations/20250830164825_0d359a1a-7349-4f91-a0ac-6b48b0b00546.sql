-- 1) Drop dependent trigger and policies cleanly
DROP TRIGGER IF EXISTS trigger_auto_user_ref ON public.business_users;
DROP POLICY IF EXISTS "Business users can view their business users" ON public.business_users;
DROP POLICY IF EXISTS "Admins can manage business users" ON public.business_users;

-- 2) Prepare new column and backfill data before dropping old column
ALTER TABLE public.business_users ADD COLUMN IF NOT EXISTS company_id UUID;
UPDATE public.business_users SET company_id = business_id WHERE company_id IS NULL AND business_id IS NOT NULL;

-- 3) Add FK after backfill (avoids early constraint failures)
ALTER TABLE public.business_users
  ADD CONSTRAINT IF NOT EXISTS business_users_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;

-- 4) Drop old trigger function and old helper, then recreate new versions
DROP FUNCTION IF EXISTS public.auto_generate_user_ref();
DROP FUNCTION IF EXISTS public.generate_user_ref(uuid);

CREATE OR REPLACE FUNCTION public.generate_user_ref(comp_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    new_ref TEXT;
    comp_ref TEXT;
    counter INTEGER;
BEGIN
    -- Try business_ref_no if present
    SELECT business_ref_no INTO comp_ref FROM public.companies WHERE id = comp_id;

    -- Fallback to first 4 letters of company name
    IF comp_ref IS NULL OR comp_ref = '' THEN
        SELECT 'COMP-' || UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(name,''), '[^A-Za-z]', '', 'g') FROM 1 FOR 4))
        INTO comp_ref FROM public.companies WHERE id = comp_id;
    END IF;

    -- Next user counter for this company
    SELECT COALESCE(MAX(CAST(SUBSTRING(bu.user_ref FROM LENGTH(comp_ref || '-U') + 1) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.business_users bu
    WHERE bu.company_id = comp_id;

    new_ref := comp_ref || '-U' || LPAD(counter::TEXT, 3, '0');
    RETURN new_ref;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_generate_user_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.user_ref IS NULL OR NEW.user_ref = '' THEN
        NEW.user_ref := public.generate_user_ref(NEW.company_id);
    END IF;
    RETURN NEW;
END;
$function$;

-- 5) Recreate trigger with new function
CREATE TRIGGER trigger_auto_user_ref
BEFORE INSERT ON public.business_users
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_user_ref();

-- 6) Now it is safe to drop old column
ALTER TABLE public.business_users DROP COLUMN IF EXISTS business_id;

-- 7) Recreate RLS policies using company_id and include WITH CHECK for inserts
CREATE POLICY "Business users can view their business users"
ON public.business_users
FOR SELECT
USING (company_id IN (
  SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
));

CREATE POLICY "Admins can manage business users"
ON public.business_users
FOR ALL
USING (company_id IN (
  SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('owner','admin')
))
WITH CHECK (company_id IN (
  SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('owner','admin')
));
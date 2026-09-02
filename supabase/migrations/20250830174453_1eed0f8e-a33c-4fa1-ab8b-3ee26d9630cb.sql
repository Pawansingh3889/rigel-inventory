-- Fix security warnings: Add search_path to functions

-- Fix auto_generate_company_business_ref function
CREATE OR REPLACE FUNCTION public.auto_generate_company_business_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    IF NEW.business_ref_no IS NULL OR NEW.business_ref_no = '' THEN
        NEW.business_ref_no := generate_gated_business_ref_no();
    END IF;
    RETURN NEW;
END;
$function$;

-- Fix user_company_id function to use search_path
CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$function$;

-- Fix get_user_company_id function to use search_path  
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$function$;

-- Fix is_user_admin function to use search_path
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  );
$function$;
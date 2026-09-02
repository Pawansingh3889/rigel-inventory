-- Fix security warnings by setting search_path for functions

-- Update existing functions to have proper search_path
DROP FUNCTION IF EXISTS public.check_email_exists(text);

CREATE OR REPLACE FUNCTION public.check_email_exists(email_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_exists boolean := false;
BEGIN
  -- Check if there's a user with this email in auth.users
  SELECT EXISTS(
    SELECT 1 FROM auth.users 
    WHERE email = email_to_check
  ) INTO user_exists;
  
  RETURN user_exists;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Update existing functions to have proper search_path
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$function$;
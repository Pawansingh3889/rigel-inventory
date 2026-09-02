-- Fix remaining security linter warnings by adding search_path to all functions

-- Fix for generate_otp_with_expiry function
CREATE OR REPLACE FUNCTION public.generate_otp_with_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  NEW.otp_expires_at = now() + interval '3 minutes';
  RETURN NEW;
END;
$function$;

-- Fix for update_updated_at_column function  
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix for check_email_exists function
CREATE OR REPLACE FUNCTION public.check_email_exists(email_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
$function$;
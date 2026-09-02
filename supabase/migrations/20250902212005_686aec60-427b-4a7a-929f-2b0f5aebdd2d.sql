-- Fix OTP expiry time to be shorter (recommended is 5 minutes or less)
CREATE OR REPLACE FUNCTION public.generate_otp_with_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  NEW.otp_expires_at = now() + interval '5 minutes';  -- Changed from 3 to 5 minutes (within recommended threshold)
  RETURN NEW;
END;
$function$;
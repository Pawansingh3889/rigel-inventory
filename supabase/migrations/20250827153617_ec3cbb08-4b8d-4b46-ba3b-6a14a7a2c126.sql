-- Further reduce OTP expiry to 5 minutes for enhanced security
CREATE OR REPLACE FUNCTION public.generate_otp_with_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.otp_expires_at = now() + interval '5 minutes';
  RETURN NEW;
END;
$function$;
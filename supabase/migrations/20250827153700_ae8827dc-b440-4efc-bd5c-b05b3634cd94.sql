-- Set OTP expiry to 3 minutes (180 seconds) for maximum security
CREATE OR REPLACE FUNCTION public.generate_otp_with_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.otp_expires_at = now() + interval '3 minutes';
  RETURN NEW;
END;
$function$;
-- Fix remaining database function security issues
-- Add proper search_path to all security-sensitive functions

-- Update all functions that currently lack SET search_path = public

-- Fix get_current_company_context function
CREATE OR REPLACE FUNCTION public.get_current_company_context()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  -- For owners, return the company_id from their current session/context
  -- For now, return their primary company from profiles
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$function$;

-- Fix set_current_timestamp_updated_at function
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- Fix log_transaction_audit function
CREATE OR REPLACE FUNCTION public.log_transaction_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  INSERT INTO transaction_audit_log (
    table_name,
    record_id,
    action,
    user_id,
    company_id,
    old_values,
    new_values
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    auth.uid(),
    COALESCE(NEW.company_id, OLD.company_id),
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Add automatic cleanup for old OTP records (security enhancement)
-- This function will be called to clean up expired OTP records
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  -- Delete OTP records older than 24 hours
  DELETE FROM public.email_otps 
  WHERE expires_at < now() - interval '24 hours';
  
  -- Log the cleanup action
  INSERT INTO public.security_audit_log (action, details, ip_address) 
  VALUES ('otp_cleanup', jsonb_build_object('deleted_count', ROW_COUNT), '127.0.0.1');
END;
$function$;

-- Add automatic cleanup for old security audit logs (prevent log table from growing indefinitely)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  -- Keep only last 90 days of audit logs
  DELETE FROM public.security_audit_log 
  WHERE created_at < now() - interval '90 days';
END;
$function$;

-- Add automatic cleanup for old rate limit records
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  -- Delete rate limit records older than 24 hours
  DELETE FROM public.auth_rate_limits 
  WHERE last_attempt < now() - interval '24 hours';
END;
$function$;
-- Fix Critical Security Vulnerabilities in Authentication Tables
-- This migration addresses the critical security issues found in the security review

-- 1. Fix email_otps table security - restrict access to system processes only
DROP POLICY IF EXISTS "Restrict OTP access to authentication flows" ON public.email_otps;
DROP POLICY IF EXISTS "System can manage OTP records for authentication" ON public.email_otps;

-- Create secure policies for email_otps (system processes only)
CREATE POLICY "System processes can manage OTP records"
ON public.email_otps
FOR ALL
TO service_role
USING (true);

CREATE POLICY "Users can verify their own OTP"
ON public.email_otps
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND 
  email = auth.jwt()->>'email' AND
  consumed_at IS NULL AND
  expires_at > now()
);

-- 2. Fix email_confirmations table security - restrict to system processes only
DROP POLICY IF EXISTS "Allow email confirmation operations" ON public.email_confirmations;

-- Create secure policies for email_confirmations
CREATE POLICY "System processes can manage email confirmations"
ON public.email_confirmations
FOR ALL
TO service_role
USING (true);

CREATE POLICY "Users can verify their own email confirmation"
ON public.email_confirmations
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND 
  email = auth.jwt()->>'email' AND
  consumed_at IS NULL AND
  expires_at > now()
);

-- 3. Fix password_resets table security - remove public access
DROP POLICY IF EXISTS "Allow password reset operations" ON public.password_resets;

-- Create secure policies for password_resets
CREATE POLICY "System processes can manage password resets"
ON public.password_resets
FOR ALL
TO service_role
USING (true);

CREATE POLICY "Users can access their own password reset tokens"
ON public.password_resets
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() AND
  used_at IS NULL AND
  expires_at > now()
);

-- 4. Add security definer function for safe role checking to prevent privilege escalation
CREATE OR REPLACE FUNCTION public.get_user_role_safe()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()),
    'staff'
  );
$$;

-- 5. Add function to validate role hierarchy and prevent privilege escalation
CREATE OR REPLACE FUNCTION public.can_manage_user_role(target_role text, current_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN target_role = 'owner' THEN 
      EXISTS(SELECT 1 FROM public.profiles WHERE user_id = current_user_id AND role = 'owner')
    WHEN target_role IN ('admin', 'manager') THEN
      EXISTS(SELECT 1 FROM public.profiles WHERE user_id = current_user_id AND role IN ('owner', 'admin'))
    WHEN target_role = 'staff' THEN
      EXISTS(SELECT 1 FROM public.profiles WHERE user_id = current_user_id AND role IN ('owner', 'admin', 'manager'))
    ELSE false
  END;
$$;

-- 6. Add security audit function for role changes
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log role changes for security auditing
  IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO public.security_audit_log (
      user_id,
      action,
      details,
      ip_address
    ) VALUES (
      auth.uid(),
      'role_changed',
      jsonb_build_object(
        'target_user_id', NEW.user_id,
        'old_role', OLD.role,
        'new_role', NEW.role,
        'changed_by', auth.uid()
      ),
      '127.0.0.1'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger for role change auditing
DROP TRIGGER IF EXISTS audit_role_changes ON public.profiles;
CREATE TRIGGER audit_role_changes
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_role_change();

-- 7. Add policy to prevent unauthorized role changes
CREATE OR REPLACE FUNCTION public.validate_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent role changes if user doesn't have permission
  IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT public.can_manage_user_role(NEW.role) THEN
      RAISE EXCEPTION 'Insufficient permissions to assign role: %', NEW.role;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger for role change validation
DROP TRIGGER IF EXISTS validate_role_changes ON public.profiles;
CREATE TRIGGER validate_role_changes
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_role_change();

-- 8. Add cleanup functions for enhanced security maintenance
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clean up expired OTPs
  DELETE FROM public.email_otps WHERE expires_at < now() - interval '1 day';
  
  -- Clean up expired email confirmations
  DELETE FROM public.email_confirmations WHERE expires_at < now() - interval '7 days';
  
  -- Clean up used password resets
  DELETE FROM public.password_resets WHERE used_at IS NOT NULL AND used_at < now() - interval '7 days';
  
  -- Clean up old rate limit records
  DELETE FROM public.auth_rate_limits WHERE last_attempt < now() - interval '7 days';
END;
$$;

-- 9. Add security monitoring function
CREATE OR REPLACE FUNCTION public.check_security_anomalies()
RETURNS TABLE(anomaly_type text, count bigint, details jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check for multiple failed login attempts
  SELECT 'high_failed_logins' as anomaly_type, 
         count(*) as count,
         jsonb_build_object('emails', array_agg(DISTINCT email)) as details
  FROM public.auth_rate_limits 
  WHERE attempt_count >= 5 
    AND last_attempt > now() - interval '1 hour'
  HAVING count(*) > 0
  
  UNION ALL
  
  -- Check for accounts with elevated privileges
  SELECT 'elevated_privilege_users' as anomaly_type,
         count(*) as count,
         jsonb_build_object('users', array_agg(user_id)) as details
  FROM public.profiles
  WHERE role IN ('owner', 'admin')
  HAVING count(*) > 0
  
  UNION ALL
  
  -- Check for recent security events
  SELECT 'recent_security_events' as anomaly_type,
         count(*) as count,
         jsonb_build_object('events', array_agg(DISTINCT action)) as details
  FROM public.security_audit_log
  WHERE created_at > now() - interval '24 hours'
    AND action IN ('login_failed', 'rate_limit_exceeded', 'role_changed')
  HAVING count(*) > 10;
$$;
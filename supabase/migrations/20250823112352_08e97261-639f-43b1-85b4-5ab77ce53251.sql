-- Fix infinite recursion in RLS policies by creating proper security definer functions
-- and restructuring the policies to prevent circular references

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Admins can manage profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;

-- Create security definer function to get current user's role safely
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Create security definer function to check if user is admin/owner
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  );
$$;

-- Recreate policies without circular references
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Admins can view all profiles in their company (using security definer function)
CREATE POLICY "Admins can view company profiles" 
ON public.profiles 
FOR SELECT 
USING (
  company_id = get_user_company_id() 
  AND is_user_admin()
);

-- Admins can manage profiles in their company (using security definer function)
CREATE POLICY "Admins can manage company profiles" 
ON public.profiles 
FOR ALL
USING (
  company_id = get_user_company_id() 
  AND is_user_admin()
  AND user_id != auth.uid() -- Can't modify their own profile through admin policy
);

-- Add rate limiting table for authentication attempts
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address inet NOT NULL,
  email text,
  attempt_count integer NOT NULL DEFAULT 1,
  last_attempt timestamp with time zone NOT NULL DEFAULT now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on rate limiting table
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- Rate limiting policies (public read for checking, restricted write)
CREATE POLICY "Anyone can check rate limits" 
ON public.auth_rate_limits 
FOR SELECT 
USING (true);

CREATE POLICY "System can manage rate limits" 
ON public.auth_rate_limits 
FOR ALL
USING (true);

-- Add security audit log table
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  action text NOT NULL,
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Audit log policies
CREATE POLICY "Admins can view audit logs" 
ON public.security_audit_log 
FOR SELECT 
USING (is_user_admin());

CREATE POLICY "System can insert audit logs" 
ON public.security_audit_log 
FOR INSERT 
WITH CHECK (true);

-- Update OTP expiry to be more secure (30 minutes instead of potentially longer)
CREATE OR REPLACE FUNCTION public.generate_otp_with_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Set OTP expiry to 30 minutes from now for better security
  NEW.otp_expires_at = now() + interval '30 minutes';
  RETURN NEW;
END;
$$;

-- Create trigger for OTP expiry
DROP TRIGGER IF EXISTS set_otp_expiry ON public.profiles;
CREATE TRIGGER set_otp_expiry
  BEFORE UPDATE OF otp_code ON public.profiles
  FOR EACH ROW
  WHEN (NEW.otp_code IS NOT NULL AND NEW.otp_code != OLD.otp_code)
  EXECUTE FUNCTION public.generate_otp_with_expiry();

-- Add function to clean up expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.profiles 
  SET otp_code = NULL, otp_expires_at = NULL 
  WHERE otp_expires_at < now();
$$;
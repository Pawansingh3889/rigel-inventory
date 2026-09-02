-- Remove overly permissive RLS policies that expose sensitive data
DROP POLICY IF EXISTS "Public can view businesses" ON public.businesses;
DROP POLICY IF EXISTS "System can manage subscriptions" ON public.subscriptions;

-- Create secure company-isolated policies for businesses
CREATE POLICY "Company users can view their business data" 
ON public.businesses 
FOR SELECT 
USING (id IN (
  SELECT p.company_id 
  FROM profiles p 
  WHERE p.user_id = auth.uid()
));

CREATE POLICY "Company admins can update their business" 
ON public.businesses 
FOR UPDATE 
USING (id IN (
  SELECT p.company_id 
  FROM profiles p 
  WHERE p.user_id = auth.uid() 
  AND p.role IN ('owner', 'admin')
));

-- Secure subscription access to business owners/admins only
CREATE POLICY "Business owners can manage their subscriptions" 
ON public.subscriptions 
FOR ALL
USING (business_id IN (
  SELECT p.company_id 
  FROM profiles p 
  WHERE p.user_id = auth.uid() 
  AND p.role IN ('owner', 'admin')
));

-- Reduce OTP expiry from 30 to 10 minutes for better security
CREATE OR REPLACE FUNCTION public.generate_otp_with_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.otp_expires_at = now() + interval '10 minutes';
  RETURN NEW;
END;
$function$;

-- Update cleanup function for expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.profiles 
  SET otp_code = NULL, otp_expires_at = NULL 
  WHERE otp_expires_at < now();
$function$;
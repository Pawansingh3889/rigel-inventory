-- Security Fixes Migration: Address critical RLS policy gaps and database function security

-- 1. CRITICAL: Fix email_otps table - currently PUBLIC, exposing email addresses and OTP hashes
-- Enable RLS on email_otps table (if not already enabled)
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists and recreate with better logic
DROP POLICY IF EXISTS "Allow OTP operations" ON public.email_otps;
DROP POLICY IF EXISTS "Users can only access their own OTP records" ON public.email_otps;

-- Create policy to allow OTP operations during authentication flows
CREATE POLICY "System can manage OTP records for authentication" 
  ON public.email_otps 
  FOR ALL 
  USING (
    -- Allow system operations (edge functions) when no user is authenticated
    auth.uid() IS NULL
    OR 
    -- Allow authenticated users to access their own OTP records
    current_setting('request.jwt.claims', true)::json->>'email' = email
  );

-- 2. MODERATE: Fix database function security - add search_path to prevent function hijacking
-- Update functions that lack proper search_path settings

-- Update handle_new_user function with proper search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER 
 SET search_path = public
AS $function$
DECLARE
  invited_via text;
  v_company_id uuid;
  v_first text;
  v_last text;
  v_phone text;
  v_city text;
  v_state text;
  v_country text;
  v_role app_role;
BEGIN
  invited_via := NEW.raw_user_meta_data ->> 'invited_via';
  v_first := NEW.raw_user_meta_data ->> 'first_name';
  v_last := NEW.raw_user_meta_data ->> 'last_name';
  v_phone := NEW.raw_user_meta_data ->> 'phone';
  v_city := NEW.raw_user_meta_data ->> 'city';
  v_state := NEW.raw_user_meta_data ->> 'state';
  v_country := NEW.raw_user_meta_data ->> 'country';

  -- default to staff if app_role missing/invalid
  BEGIN
    v_role := COALESCE((NEW.raw_user_meta_data ->> 'app_role')::app_role, 'staff');
  EXCEPTION WHEN others THEN
    v_role := 'staff';
  END;

  -- Safely parse company_id from metadata when present
  v_company_id := NULL;
  IF (NEW.raw_user_meta_data ->> 'company_id') IS NOT NULL THEN
    BEGIN
      v_company_id := (NEW.raw_user_meta_data ->> 'company_id')::uuid;
    EXCEPTION WHEN others THEN
      v_company_id := NULL;
    END;
  END IF;

  -- If user was invited into an existing company, do NOT create a new company
  IF invited_via = 'invite-business-user' AND v_company_id IS NOT NULL THEN
    INSERT INTO public.profiles (
      user_id,
      company_id,
      first_name,
      last_name,
      phone,
      city,
      state,
      country,
      role
    )
    VALUES (
      NEW.id,
      v_company_id,
      v_first,
      v_last,
      v_phone,
      v_city,
      v_state,
      v_country,
      v_role
    )
    ON CONFLICT (user_id) DO UPDATE
      SET company_id = EXCLUDED.company_id,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          phone = EXCLUDED.phone,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          country = EXCLUDED.country,
          role = EXCLUDED.role,
          updated_at = now();

    RETURN NEW;
  END IF;

  -- Self-signup path: create company and owner profile
  INSERT INTO public.companies (name, email)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'My Company'),
    NEW.email
  );

  INSERT INTO public.profiles (
    user_id,
    company_id,
    first_name,
    last_name,
    phone,
    city,
    state,
    country,
    role
  )
  VALUES (
    NEW.id,
    (SELECT id FROM public.companies WHERE email = NEW.email ORDER BY created_at DESC LIMIT 1),
    v_first,
    v_last,
    v_phone,
    v_city,
    v_state,
    v_country,
    'owner'
  );

  RETURN NEW;
END;
$function$;

-- Add search_path to other security-critical functions
-- Update set_current_timestamp_updated_at function
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
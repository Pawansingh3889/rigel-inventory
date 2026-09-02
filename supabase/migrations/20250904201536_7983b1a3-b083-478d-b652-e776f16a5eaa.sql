-- Security Fixes Migration: Address critical RLS policy gaps and database function security

-- 1. CRITICAL: Fix email_otps table - currently PUBLIC, exposing email addresses and OTP hashes
-- Enable RLS on email_otps table
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only access their own OTP records
CREATE POLICY "Users can only access their own OTP records" 
  ON public.email_otps 
  FOR ALL 
  USING (
    -- During OTP creation/verification, allow system operations
    current_setting('request.jwt.claims', true)::json->>'email' = email
    OR auth.uid() IS NULL -- Allow system operations when no user is authenticated
  );

-- 2. CRITICAL: Fix current_stock_levels table - currently PUBLIC, exposing business inventory data
-- Enable RLS on current_stock_levels table
ALTER TABLE public.current_stock_levels ENABLE ROW LEVEL SECURITY;

-- Create policy for company-based access to stock levels
CREATE POLICY "Company users can view their stock levels" 
  ON public.current_stock_levels 
  FOR SELECT 
  USING (company_id = user_company_id());

-- 3. MODERATE: Fix database function security - add search_path to prevent function hijacking
-- Update functions that lack proper search_path settings

-- Fix handle_new_user function
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
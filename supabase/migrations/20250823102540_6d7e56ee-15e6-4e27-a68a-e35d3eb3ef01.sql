-- Add new fields to profiles table for enhanced signup
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS otp_code text,
ADD COLUMN IF NOT EXISTS otp_expires_at timestamp with time zone;

-- Update the handle_new_user function to include new fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Create company first
  INSERT INTO public.companies (name, email)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'My Company'),
    NEW.email
  );
  
  -- Then create profile linked to the company with new fields
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
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'city',
    NEW.raw_user_meta_data ->> 'state',
    NEW.raw_user_meta_data ->> 'country',
    'owner'
  );
  
  RETURN NEW;
END;
$function$;
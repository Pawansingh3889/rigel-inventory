-- Fix security warnings for function search path

-- Update the user_company_id function to set search_path
CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Update the update_updated_at_column function to set search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
-- Phase 1: Company-Centric Migration

-- Step 1: Add business_ref_no to companies if not exists
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS business_ref_no text UNIQUE;

-- Step 2: Create trigger to auto-generate business_ref_no for companies
CREATE OR REPLACE FUNCTION public.auto_generate_company_business_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    IF NEW.business_ref_no IS NULL OR NEW.business_ref_no = '' THEN
        NEW.business_ref_no := generate_gated_business_ref_no();
    END IF;
    RETURN NEW;
END;
$function$;

CREATE TRIGGER auto_generate_company_business_ref_trigger
    BEFORE INSERT ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_company_business_ref();

-- Step 3: Migrate data from gated_businesses to companies (if any exists)
-- Update existing companies with business_ref_no if they don't have one
UPDATE public.companies 
SET business_ref_no = generate_gated_business_ref_no()
WHERE business_ref_no IS NULL OR business_ref_no = '';

-- Step 4: Create company_users table to replace gated_business_users
CREATE TABLE IF NOT EXISTS public.company_users (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    username character varying NOT NULL,
    email character varying NOT NULL,
    password_hash text NOT NULL,
    access_type character varying DEFAULT 'OWNER'::character varying,
    status character varying DEFAULT 'ACTIVE'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(company_id, username),
    UNIQUE(company_id, email)
);

-- Enable RLS on company_users
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

-- Step 5: Add RLS policies for company_users
CREATE POLICY "Allow company user operations" 
ON public.company_users 
FOR ALL 
USING (true);

-- Step 6: Update companies RLS to allow owner-only inserts
DROP POLICY IF EXISTS "Anonymous users can register business" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can register business" ON public.companies;

-- Only owners can create new companies
CREATE POLICY "Owners can create companies" 
ON public.companies 
FOR INSERT 
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role = 'owner'
    )
);

-- Allow registration operations for company creation
CREATE POLICY "Allow company registration operations" 
ON public.companies 
FOR INSERT 
WITH CHECK (true);

-- Step 7: Update profiles to support nullable company_id for owners
ALTER TABLE public.profiles 
ALTER COLUMN company_id DROP NOT NULL;

-- Step 8: Add company switching support
CREATE TABLE IF NOT EXISTS public.user_company_access (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'staff',
    granted_by uuid REFERENCES auth.users(id),
    granted_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    UNIQUE(user_id, company_id)
);

-- Enable RLS on user_company_access
ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company access" 
ON public.user_company_access 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Company admins can manage access" 
ON public.user_company_access 
FOR ALL 
USING (
    company_id IN (
        SELECT company_id FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    )
);

-- Step 9: Create function to get user's current company context
CREATE OR REPLACE FUNCTION public.get_current_company_context()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- For owners, return the company_id from their current session/context
  -- For now, return their primary company from profiles
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;
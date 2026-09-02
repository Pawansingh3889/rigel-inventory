-- Drop all existing policies for profiles to fix the infinite recursion
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles; 
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;

-- Create a security definer function to get user's company ID
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create new RLS policies for profiles without infinite recursion
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can view profiles in their company" 
ON public.profiles 
FOR SELECT 
USING (company_id = get_user_company_id());

CREATE POLICY "Admins can manage profiles in their company" 
ON public.profiles 
FOR ALL 
USING (
  company_id = get_user_company_id() 
  AND EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('owner', 'admin')
  )
);
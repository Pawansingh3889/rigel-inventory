-- Clean up and recreate company_users RLS policies properly
DROP POLICY IF EXISTS "View team members in own company" ON public.company_users;
DROP POLICY IF EXISTS "Admins can insert team members" ON public.company_users;
DROP POLICY IF EXISTS "Admins can update team members" ON public.company_users;
DROP POLICY IF EXISTS "Admins can delete team members" ON public.company_users;

-- View team members within own company
CREATE POLICY "Team members can view company members"
ON public.company_users
FOR SELECT
USING (company_id = get_user_company_id());

-- Only admins/owners can insert
CREATE POLICY "Only admins can create team members"
ON public.company_users
FOR INSERT
WITH CHECK (company_id = get_user_company_id() AND is_user_admin());

-- Only admins/owners can update
CREATE POLICY "Only admins can update team members"
ON public.company_users
FOR UPDATE
USING (company_id = get_user_company_id() AND is_user_admin());

-- Only admins/owners can delete
CREATE POLICY "Only admins can delete team members"
ON public.company_users
FOR DELETE
USING (company_id = get_user_company_id() AND is_user_admin());
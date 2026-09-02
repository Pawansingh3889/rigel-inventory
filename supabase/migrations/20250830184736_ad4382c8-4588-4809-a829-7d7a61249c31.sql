-- Restrict company_users to admin-only mutations and same-company visibility
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow company user operations" ON public.company_users;

-- View team members within own company
CREATE POLICY "View team members in own company"
ON public.company_users
FOR SELECT
USING (company_id = get_user_company_id());

-- Only admins/owners can insert
CREATE POLICY "Admins can insert team members"
ON public.company_users
FOR INSERT
WITH CHECK (company_id = get_user_company_id() AND is_user_admin());

-- Only admins/owners can update
CREATE POLICY "Admins can update team members"
ON public.company_users
FOR UPDATE
USING (company_id = get_user_company_id() AND is_user_admin());

-- Only admins/owners can delete
CREATE POLICY "Admins can delete team members"
ON public.company_users
FOR DELETE
USING (company_id = get_user_company_id() AND is_user_admin());
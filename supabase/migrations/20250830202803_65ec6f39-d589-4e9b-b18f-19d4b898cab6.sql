-- Remove role column from company_users to avoid confusion with access_type and profiles.role
ALTER TABLE public.company_users
DROP COLUMN IF EXISTS role;
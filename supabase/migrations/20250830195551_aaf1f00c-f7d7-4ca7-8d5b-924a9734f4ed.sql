-- Add missing fields to company_users table
ALTER TABLE public.company_users 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Update existing records to have proper role mapping
UPDATE public.company_users 
SET role = CASE 
  WHEN access_type = 'ADMIN' THEN 'admin'
  WHEN access_type = 'USER' THEN 'editor'
  ELSE 'viewer'
END
WHERE role IS NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_company_users_user_id ON public.company_users(user_id);
CREATE INDEX IF NOT EXISTS idx_company_users_created_by ON public.company_users(created_by);
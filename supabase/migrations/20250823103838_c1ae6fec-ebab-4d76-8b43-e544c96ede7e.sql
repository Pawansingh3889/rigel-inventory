-- Create a function to check if email exists in auth.users table  
-- Note: This is a workaround since we can't directly query auth.users from the client
CREATE OR REPLACE FUNCTION public.check_email_exists(email_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_exists boolean := false;
BEGIN
  -- Check if there's a profile with this email (which means user exists)
  SELECT EXISTS(
    SELECT 1 FROM auth.users 
    WHERE email = email_to_check
  ) INTO user_exists;
  
  RETURN user_exists;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;
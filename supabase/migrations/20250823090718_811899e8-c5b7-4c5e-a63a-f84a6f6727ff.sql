-- Create trigger to automatically create company and profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create company first
  INSERT INTO public.companies (name, email)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'My Company'),
    NEW.email
  );
  
  -- Then create profile linked to the company
  INSERT INTO public.profiles (user_id, company_id, first_name, last_name, role)
  VALUES (
    NEW.id,
    (SELECT id FROM public.companies WHERE email = NEW.email ORDER BY created_at DESC LIMIT 1),
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    'owner'
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- Reset SELECT policies on businesses to allow reading the inserted row by the signed-in user
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies 
    WHERE schemaname='public' AND tablename='businesses' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.businesses', pol.policyname);
  END LOOP;

  -- Allow owners/admins via profiles
  CREATE POLICY "Users can view their own business (profiles)"
  ON public.businesses
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );

  -- Additionally allow the signed-in user to read businesses matching their email (for registration flow)
  CREATE POLICY "Users can view business by matching email"
  ON public.businesses
  FOR SELECT
  TO authenticated
  USING (
    email = (auth.jwt() ->> 'email')
  );
END $$;
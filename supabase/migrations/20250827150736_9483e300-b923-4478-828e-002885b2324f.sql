-- Ensure required columns exist
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS full_address text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS gstn_number text;

-- Create trigger to auto-generate business_ref if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_generate_business_ref'
  ) THEN
    CREATE TRIGGER trg_auto_generate_business_ref
    BEFORE INSERT ON public.businesses
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_business_ref();
  END IF;
END $$;

-- Replace INSERT policies to ensure public (anon) can register a business
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies 
    WHERE schemaname='public' AND tablename='businesses' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.businesses', pol.policyname);
  END LOOP;

  CREATE POLICY "Public can register a business"
  ON public.businesses
  FOR INSERT
  TO public
  WITH CHECK (true);
END $$;

-- Keep updated_at current automatically on updates (optional but recommended)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_businesses_updated_at'
  ) THEN
    CREATE TRIGGER trg_businesses_updated_at
    BEFORE UPDATE ON public.businesses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
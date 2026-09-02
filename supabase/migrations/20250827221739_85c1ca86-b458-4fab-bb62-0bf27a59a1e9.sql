-- Add missing fields to companies table for complete company profile data
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS gstn TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS business_ref_no TEXT UNIQUE;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Create business_credentials table for authentication data
CREATE TABLE IF NOT EXISTS public.business_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, username)
);

-- Enable RLS on business_credentials
ALTER TABLE public.business_credentials ENABLE ROW LEVEL SECURITY;

-- Create policies for business_credentials
CREATE POLICY "Company owners can manage their credentials" 
ON public.business_credentials 
FOR ALL 
USING (company_id IN (
  SELECT profiles.company_id
  FROM profiles
  WHERE (profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role]))
));

-- Add trigger for updated_at
CREATE TRIGGER update_business_credentials_updated_at
BEFORE UPDATE ON public.business_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate business reference number
CREATE OR REPLACE FUNCTION public.generate_business_ref_no(company_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    first_four_letters TEXT;
    current_month TEXT;
    current_year TEXT;
    ref_no TEXT;
BEGIN
    -- Extract first 4 letters from company name
    first_four_letters := UPPER(SUBSTRING(REGEXP_REPLACE(company_name, '[^A-Za-z]', '', 'g') FROM 1 FOR 4));
    
    -- Get current month and year
    current_month := LPAD(EXTRACT(MONTH FROM NOW())::TEXT, 2, '0');
    current_year := EXTRACT(YEAR FROM NOW())::TEXT;
    
    -- Generate reference number
    ref_no := 'PRISM-' || first_four_letters || '-' || current_month || '-' || current_year;
    
    RETURN ref_no;
END;
$$;
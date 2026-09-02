-- Create gated businesses table for new registration system
CREATE TABLE public.gated_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_ref_no VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(200) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  addr_line1 VARCHAR(200) NOT NULL,
  addr_line2 VARCHAR(200),
  state VARCHAR(100) NOT NULL,
  pin_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL,
  business_type VARCHAR(60) NOT NULL,
  industry_type VARCHAR(100) NOT NULL,
  gstin VARCHAR(15),
  payment_status VARCHAR(20) DEFAULT 'PAID',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create gated business users table for custom authentication
CREATE TABLE public.gated_business_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.gated_businesses(id) ON DELETE CASCADE,
  username VARCHAR(30) NOT NULL,
  email VARCHAR(200) NOT NULL,
  password_hash TEXT NOT NULL,
  access_type VARCHAR(20) DEFAULT 'OWNER',
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (business_id, username)
);

-- Create email OTPs table for verification
CREATE TABLE public.email_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(200) NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  consumed_at TIMESTAMP WITH TIME ZONE,
  attempt_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create password resets table
CREATE TABLE public.password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.gated_business_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gated_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gated_business_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow public access during registration and auth flows
CREATE POLICY "Allow registration operations" ON public.gated_businesses
FOR ALL USING (true);

CREATE POLICY "Allow user operations" ON public.gated_business_users
FOR ALL USING (true);

CREATE POLICY "Allow OTP operations" ON public.email_otps
FOR ALL USING (true);

CREATE POLICY "Allow password reset operations" ON public.password_resets
FOR ALL USING (true);

-- Function to generate business reference number
CREATE OR REPLACE FUNCTION public.generate_gated_business_ref_no()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    ref_no TEXT;
    date_part TEXT;
    random_part TEXT;
BEGIN
    -- Get current date in YYYYMMDD format
    date_part := to_char(now(), 'YYYYMMDD');
    
    -- Generate 5 character random alphanumeric string
    random_part := upper(substr(md5(random()::text), 1, 5));
    
    -- Combine to create reference number
    ref_no := 'BUS-' || date_part || '-' || random_part;
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM public.gated_businesses WHERE business_ref_no = ref_no) LOOP
        random_part := upper(substr(md5(random()::text), 1, 5));
        ref_no := 'BUS-' || date_part || '-' || random_part;
    END LOOP;
    
    RETURN ref_no;
END;
$$;

-- Trigger to auto-generate business reference number
CREATE OR REPLACE FUNCTION public.auto_generate_gated_business_ref()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.business_ref_no IS NULL OR NEW.business_ref_no = '' THEN
        NEW.business_ref_no := generate_gated_business_ref_no();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_gated_business_ref
    BEFORE INSERT ON public.gated_businesses
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_gated_business_ref();

-- Triggers for updated_at
CREATE TRIGGER trigger_gated_businesses_updated_at
    BEFORE UPDATE ON public.gated_businesses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_gated_business_users_updated_at
    BEFORE UPDATE ON public.gated_business_users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
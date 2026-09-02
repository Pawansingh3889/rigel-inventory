-- Create businesses table
CREATE TYPE business_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE subscription_plan AS ENUM ('monthly', 'yearly');
CREATE TYPE user_role AS ENUM ('Admin', 'User', 'ViewOnly');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- Businesses Table
CREATE TABLE public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_ref VARCHAR(20) UNIQUE NOT NULL, -- Format: BUS-XXXXXX
    business_name TEXT NOT NULL,
    owner_name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    industry_type TEXT,
    subscription_plan subscription_plan,
    subscription_status business_status DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Business Users Table (separate from auth users)
CREATE TABLE public.business_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_ref VARCHAR(30) UNIQUE NOT NULL, -- Format: BUSREF-UXXX
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    role user_role DEFAULT 'User',
    access_sections JSONB, -- stores allowed sections for User/ViewOnly
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subscriptions Table for payment history tracking
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    plan_type subscription_plan,
    payment_status payment_status DEFAULT 'pending',
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'INR',
    stripe_session_id TEXT,
    stripe_subscription_id TEXT,
    start_date DATE DEFAULT current_date,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for businesses
CREATE POLICY "Users can view their own business" ON public.businesses
FOR SELECT USING (
    id IN (
        SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()
    )
);

CREATE POLICY "Admins can update their business" ON public.businesses
FOR UPDATE USING (
    id IN (
        SELECT p.company_id FROM profiles p 
        WHERE p.user_id = auth.uid() AND p.role IN ('owner', 'admin')
    )
);

-- RLS Policies for business_users
CREATE POLICY "Business users can view their business users" ON public.business_users
FOR SELECT USING (
    business_id IN (
        SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()
    )
);

CREATE POLICY "Admins can manage business users" ON public.business_users
FOR ALL USING (
    business_id IN (
        SELECT p.company_id FROM profiles p 
        WHERE p.user_id = auth.uid() AND p.role IN ('owner', 'admin')
    )
);

-- RLS Policies for subscriptions
CREATE POLICY "Business can view their subscriptions" ON public.subscriptions
FOR SELECT USING (
    business_id IN (
        SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()
    )
);

CREATE POLICY "System can manage subscriptions" ON public.subscriptions
FOR ALL USING (true);

-- Functions to generate reference numbers
CREATE OR REPLACE FUNCTION generate_business_ref()
RETURNS TEXT AS $$
DECLARE
    new_ref TEXT;
    counter INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(business_ref FROM 5) AS INTEGER)), 0) + 1
    INTO counter
    FROM businesses;
    
    new_ref := 'BUS-' || LPAD(counter::TEXT, 6, '0');
    RETURN new_ref;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_user_ref(bus_id UUID)
RETURNS TEXT AS $$
DECLARE
    new_ref TEXT;
    bus_ref TEXT;
    counter INTEGER;
BEGIN
    SELECT business_ref INTO bus_ref FROM businesses WHERE id = bus_id;
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(user_ref FROM LENGTH(bus_ref || '-U') + 1) AS INTEGER)), 0) + 1
    INTO counter
    FROM business_users
    WHERE business_id = bus_id;
    
    new_ref := bus_ref || '-U' || LPAD(counter::TEXT, 3, '0');
    RETURN new_ref;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-generate reference numbers
CREATE OR REPLACE FUNCTION auto_generate_business_ref()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.business_ref IS NULL OR NEW.business_ref = '' THEN
        NEW.business_ref := generate_business_ref();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_generate_user_ref()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_ref IS NULL OR NEW.user_ref = '' THEN
        NEW.user_ref := generate_user_ref(NEW.business_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_business_ref
    BEFORE INSERT ON businesses
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_business_ref();

CREATE TRIGGER trigger_auto_user_ref
    BEFORE INSERT ON business_users
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_user_ref();

-- Trigger for updated_at
CREATE TRIGGER update_businesses_updated_at
    BEFORE UPDATE ON businesses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_users_updated_at
    BEFORE UPDATE ON business_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
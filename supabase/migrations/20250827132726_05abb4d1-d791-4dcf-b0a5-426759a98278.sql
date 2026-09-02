-- Fix security warnings by setting search_path for functions
CREATE OR REPLACE FUNCTION generate_business_ref()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION generate_user_ref(bus_id UUID)
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION auto_generate_business_ref()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.business_ref IS NULL OR NEW.business_ref = '' THEN
        NEW.business_ref := generate_business_ref();
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION auto_generate_user_ref()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.user_ref IS NULL OR NEW.user_ref = '' THEN
        NEW.user_ref := generate_user_ref(NEW.business_id);
    END IF;
    RETURN NEW;
END;
$$;
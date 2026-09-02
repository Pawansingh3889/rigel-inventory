-- Phase 3: Data Migration & Cleanup
-- Migrate existing data from legacy tables to company-focused tables and drop unnecessary tables

-- First, migrate any existing business_users data to company_users if it doesn't exist
INSERT INTO company_users (id, company_id, username, email, password_hash, access_type, status, created_at, updated_at)
SELECT 
  bu.id,
  bu.company_id,
  bu.email, -- Use email as username since company_users expects username
  bu.email,
  bu.password_hash,
  CASE 
    WHEN bu.role = 'Admin' THEN 'ADMIN'
    ELSE 'USER'
  END,
  CASE 
    WHEN bu.is_active THEN 'ACTIVE'
    ELSE 'INACTIVE'
  END,
  bu.created_at,
  bu.updated_at
FROM business_users bu
WHERE NOT EXISTS (
  SELECT 1 FROM company_users cu WHERE cu.email = bu.email AND cu.company_id = bu.company_id
);

-- Drop unnecessary legacy tables
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS business_users CASCADE; 
DROP TABLE IF EXISTS business_credentials CASCADE;
DROP TABLE IF EXISTS gated_businesses CASCADE;
DROP TABLE IF EXISTS gated_business_users CASCADE;

-- Update database functions that reference old tables
-- Fix generate_user_ref to use company_users instead of business_users
CREATE OR REPLACE FUNCTION public.generate_user_ref(comp_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    new_ref TEXT;
    comp_ref TEXT;
    counter INTEGER;
BEGIN
    -- Try business_ref_no if present
    SELECT business_ref_no INTO comp_ref FROM public.companies WHERE id = comp_id;

    -- Fallback to first 4 letters of company name
    IF comp_ref IS NULL OR comp_ref = '' THEN
        SELECT 'COMP-' || UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(name,''), '[^A-Za-z]', '', 'g') FROM 1 FOR 4))
        INTO comp_ref FROM public.companies WHERE id = comp_id;
    END IF;

    -- Next user counter for this company - use company_users table
    SELECT COALESCE(MAX(
        CASE 
            WHEN cu.username LIKE comp_ref || '-U%' THEN
                CASE 
                    WHEN SUBSTRING(cu.username FROM LENGTH(comp_ref || '-U') + 1) ~ '^[0-9]+$' THEN
                        CAST(SUBSTRING(cu.username FROM LENGTH(comp_ref || '-U') + 1) AS INTEGER)
                    ELSE 0
                END
            ELSE 0
        END
    ), 0) + 1
    INTO counter
    FROM public.company_users cu
    WHERE cu.company_id = comp_id;

    new_ref := comp_ref || '-U' || LPAD(counter::TEXT, 3, '0');
    RETURN new_ref;
END;
$function$;
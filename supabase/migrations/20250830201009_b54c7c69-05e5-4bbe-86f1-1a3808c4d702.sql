
  -- 1) Fix the ref generator so it no longer depends on a missing table
CREATE OR REPLACE FUNCTION public.generate_gated_business_ref_no()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    ref_no TEXT;
    date_part TEXT;
    random_part TEXT;
BEGIN
    -- Get current date in YYYYMMDD format
    date_part := to_char(now(), 'YYYYMMDD');

    -- Loop until we find a unique ref against companies.business_ref_no
    LOOP
        random_part := upper(substr(md5(random()::text), 1, 5));
        ref_no := 'BUS-' || date_part || '-' || random_part;

        EXIT WHEN NOT EXISTS (
            SELECT 1
            FROM public.companies
            WHERE business_ref_no = ref_no
        );
    END LOOP;

    RETURN ref_no;
END;
$function$;

-- 2) Update handle_new_user to skip company creation for invited users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  invited_via text;
  v_company_id uuid;
  v_first text;
  v_last text;
  v_phone text;
  v_city text;
  v_state text;
  v_country text;
  v_role app_role;
BEGIN
  invited_via := NEW.raw_user_meta_data ->> 'invited_via';
  v_first := NEW.raw_user_meta_data ->> 'first_name';
  v_last := NEW.raw_user_meta_data ->> 'last_name';
  v_phone := NEW.raw_user_meta_data ->> 'phone';
  v_city := NEW.raw_user_meta_data ->> 'city';
  v_state := NEW.raw_user_meta_data ->> 'state';
  v_country := NEW.raw_user_meta_data ->> 'country';

  -- default to staff if app_role missing/invalid
  BEGIN
    v_role := COALESCE((NEW.raw_user_meta_data ->> 'app_role')::app_role, 'staff');
  EXCEPTION WHEN others THEN
    v_role := 'staff';
  END;

  -- Safely parse company_id from metadata when present
  v_company_id := NULL;
  IF (NEW.raw_user_meta_data ->> 'company_id') IS NOT NULL THEN
    BEGIN
      v_company_id := (NEW.raw_user_meta_data ->> 'company_id')::uuid;
    EXCEPTION WHEN others THEN
      v_company_id := NULL;
    END;
  END IF;

  -- If user was invited into an existing company, do NOT create a new company
  IF invited_via = 'invite-business-user' AND v_company_id IS NOT NULL THEN
    INSERT INTO public.profiles (
      user_id,
      company_id,
      first_name,
      last_name,
      phone,
      city,
      state,
      country,
      role
    )
    VALUES (
      NEW.id,
      v_company_id,
      v_first,
      v_last,
      v_phone,
      v_city,
      v_state,
      v_country,
      v_role
    )
    ON CONFLICT (user_id) DO UPDATE
      SET company_id = EXCLUDED.company_id,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          phone = EXCLUDED.phone,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          country = EXCLUDED.country,
          role = EXCLUDED.role,
          updated_at = now();

    RETURN NEW;
  END IF;

  -- Self-signup path: create company and owner profile
  INSERT INTO public.companies (name, email)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'My Company'),
    NEW.email
  );

  INSERT INTO public.profiles (
    user_id,
    company_id,
    first_name,
    last_name,
    phone,
    city,
    state,
    country,
    role
  )
  VALUES (
    NEW.id,
    (SELECT id FROM public.companies WHERE email = NEW.email ORDER BY created_at DESC LIMIT 1),
    v_first,
    v_last,
    v_phone,
    v_city,
    v_state,
    v_country,
    'owner'
  );

  RETURN NEW;
END;
$function$;

-- 3) Ensure uniqueness of email per company in company_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'company_users_company_id_email_key'
  ) THEN
    CREATE UNIQUE INDEX company_users_company_id_email_key
      ON public.company_users (company_id, email);
  END IF;
END$$;
  
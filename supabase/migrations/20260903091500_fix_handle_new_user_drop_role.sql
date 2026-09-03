-- handle_new_user still inserted into public.profiles.role, a column that was dropped
-- from the live schema. Every auth.users insert therefore aborted, and GoTrue surfaced
-- it as "Database error creating new user", breaking both signup and the signin flow's
-- auth provisioning step.
--
-- Two changes:
--   1. Stop writing profiles.role. Role lives in company_users.access_type.
--   2. Skip company creation whenever the metadata already carries a company_id, not
--      just for invited_via = 'invite-business-user'. The signin function sends
--      invited_via = 'business-signin' with a company_id, and without this it would
--      fall through to the self-signup path and create a duplicate "My Company" on
--      every first login.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_company_id uuid;
  v_first text;
  v_last text;
  v_phone text;
  v_city text;
  v_state text;
  v_country text;
BEGIN
  v_first := NEW.raw_user_meta_data ->> 'first_name';
  v_last := NEW.raw_user_meta_data ->> 'last_name';
  v_phone := NEW.raw_user_meta_data ->> 'phone';
  v_city := NEW.raw_user_meta_data ->> 'city';
  v_state := NEW.raw_user_meta_data ->> 'state';
  v_country := NEW.raw_user_meta_data ->> 'country';

  -- Safely parse company_id from metadata when present
  v_company_id := NULL;
  IF (NEW.raw_user_meta_data ->> 'company_id') IS NOT NULL THEN
    BEGIN
      v_company_id := (NEW.raw_user_meta_data ->> 'company_id')::uuid;
    EXCEPTION WHEN others THEN
      v_company_id := NULL;
    END;
  END IF;

  -- User belongs to an existing company: attach, never create one.
  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.profiles (
      user_id, company_id, first_name, last_name, phone, city, state, country
    )
    VALUES (
      NEW.id, v_company_id, v_first, v_last, v_phone, v_city, v_state, v_country
    )
    ON CONFLICT (user_id) DO UPDATE
      SET company_id = EXCLUDED.company_id,
          first_name = EXCLUDED.first_name,
          last_name  = EXCLUDED.last_name,
          phone      = EXCLUDED.phone,
          city       = EXCLUDED.city,
          state      = EXCLUDED.state,
          country    = EXCLUDED.country,
          updated_at = now();

    RETURN NEW;
  END IF;

  -- Self-signup path: create the company, then the owner profile.
  INSERT INTO public.companies (name, email)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'My Company'),
    NEW.email
  )
  RETURNING id INTO v_company_id;

  INSERT INTO public.profiles (
    user_id, company_id, first_name, last_name, phone, city, state, country
  )
  VALUES (
    NEW.id, v_company_id, v_first, v_last, v_phone, v_city, v_state, v_country
  )
  ON CONFLICT (user_id) DO UPDATE
    SET company_id = EXCLUDED.company_id,
        updated_at = now();

  RETURN NEW;
END;
$function$;

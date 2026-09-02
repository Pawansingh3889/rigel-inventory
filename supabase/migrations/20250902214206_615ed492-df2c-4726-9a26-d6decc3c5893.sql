-- Identify and fix functions missing search_path parameter
DO $$
DECLARE
    func_record RECORD;
    func_sql TEXT;
BEGIN
    -- Find functions in the public schema that might be missing search_path
    FOR func_record IN 
        SELECT 
            p.proname as function_name,
            pg_get_functiondef(p.oid) as function_definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prosecdef = true  -- Only security definer functions
        AND pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%'
    LOOP
        RAISE NOTICE 'Function % is missing SET search_path', func_record.function_name;
        
        -- Fix specific functions we know about
        CASE func_record.function_name
            WHEN 'cleanup_expired_otps' THEN
                EXECUTE 'CREATE OR REPLACE FUNCTION public.cleanup_expired_otps() 
                RETURNS void 
                LANGUAGE sql 
                SECURITY DEFINER 
                SET search_path = ''public'' 
                AS $function$ 
                UPDATE public.profiles SET otp_code = NULL, otp_expires_at = NULL WHERE otp_expires_at < now(); 
                $function$';
                
            WHEN 'generate_otp_with_expiry' THEN
                EXECUTE 'CREATE OR REPLACE FUNCTION public.generate_otp_with_expiry() 
                RETURNS trigger 
                LANGUAGE plpgsql 
                SECURITY DEFINER 
                SET search_path = ''public'' 
                AS $function$ 
                BEGIN 
                  NEW.otp_expires_at = now() + interval ''3 minutes''; 
                  RETURN NEW; 
                END; 
                $function$';
                
            WHEN 'is_user_admin' THEN
                EXECUTE 'CREATE OR REPLACE FUNCTION public.is_user_admin() 
                RETURNS boolean 
                LANGUAGE sql 
                STABLE SECURITY DEFINER 
                SET search_path = ''public'' 
                AS $function$ 
                SELECT EXISTS ( SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN (''owner'', ''admin'') ); 
                $function$';
                
            WHEN 'user_company_id' THEN
                EXECUTE 'CREATE OR REPLACE FUNCTION public.user_company_id() 
                RETURNS uuid 
                LANGUAGE sql 
                STABLE SECURITY DEFINER 
                SET search_path = ''public'' 
                AS $function$ 
                SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1; 
                $function$';
                
            WHEN 'get_user_company_id' THEN
                EXECUTE 'CREATE OR REPLACE FUNCTION public.get_user_company_id() 
                RETURNS uuid 
                LANGUAGE sql 
                STABLE SECURITY DEFINER 
                SET search_path = ''public'' 
                AS $function$ 
                SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1; 
                $function$';
                
            WHEN 'get_current_company_context' THEN
                EXECUTE 'CREATE OR REPLACE FUNCTION public.get_current_company_context() 
                RETURNS uuid 
                LANGUAGE sql 
                STABLE SECURITY DEFINER 
                SET search_path = ''public'' 
                AS $function$ 
                SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1; 
                $function$';
                
            WHEN 'get_current_user_role' THEN
                EXECUTE 'CREATE OR REPLACE FUNCTION public.get_current_user_role() 
                RETURNS app_role 
                LANGUAGE sql 
                STABLE SECURITY DEFINER 
                SET search_path = ''public'' 
                AS $function$ 
                SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1; 
                $function$';
                
            WHEN 'check_email_exists' THEN
                EXECUTE 'CREATE OR REPLACE FUNCTION public.check_email_exists(email_to_check text) 
                RETURNS boolean 
                LANGUAGE plpgsql 
                SECURITY DEFINER 
                SET search_path = ''public'' 
                AS $function$ 
                DECLARE user_exists boolean := false; 
                BEGIN 
                  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = email_to_check) INTO user_exists; 
                  RETURN user_exists; 
                EXCEPTION WHEN OTHERS THEN 
                  RETURN false; 
                END; 
                $function$';
                
            ELSE
                RAISE NOTICE 'Unknown function %, skipping automatic fix', func_record.function_name;
        END CASE;
    END LOOP;
END $$;
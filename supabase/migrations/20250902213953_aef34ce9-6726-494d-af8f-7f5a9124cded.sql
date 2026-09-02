-- Process any remaining GRNs with missing inventory transactions
DO $$
DECLARE
  result_row RECORD;
  company_uuid UUID;
BEGIN
  -- Get a company ID to scope the search (or use NULL for all companies)
  SELECT id INTO company_uuid FROM public.companies LIMIT 1;
  
  -- Find and fix any missing GRN transactions
  FOR result_row IN 
    SELECT * FROM public.find_and_fix_missing_grn_transactions(company_uuid)
  LOOP
    RAISE NOTICE 'Fixed missing transactions for GRN %: %', result_row.grn_number, result_row.processing_result;
  END LOOP;
END $$;

-- Fix remaining security issues by updating function search paths that might be missing
DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- Get functions that might be missing search_path
  FOR func_record IN 
    SELECT proname, pronamespace::regnamespace as schema_name
    FROM pg_proc 
    WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('cleanup_expired_otps', 'generate_otp_with_expiry')
  LOOP
    -- Update functions to have proper search_path
    CASE func_record.proname
      WHEN 'cleanup_expired_otps' THEN
        EXECUTE 'CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
         RETURNS void
         LANGUAGE sql
         SECURITY DEFINER
         SET search_path = ''public''
         AS $function$
           UPDATE public.profiles 
           SET otp_code = NULL, otp_expires_at = NULL 
           WHERE otp_expires_at < now();
         $function$';
      
      WHEN 'generate_otp_with_expiry' THEN
        EXECUTE 'CREATE OR REPLACE FUNCTION public.generate_otp_with_expiry()
         RETURNS trigger
         LANGUAGE plpgsql
         SECURITY DEFINER
         SET search_path = ''public''
         AS $function$
         BEGIN
           NEW.otp_expires_at = now() + interval ''3 minutes'';  -- Reduced from 5 to 3 minutes
           RETURN NEW;
         END;
         $function$';
    END CASE;
  END LOOP;
END $$;
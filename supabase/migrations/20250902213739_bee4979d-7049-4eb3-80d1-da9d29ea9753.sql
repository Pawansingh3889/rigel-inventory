-- Process the specific missing GRN RIGEGRN09022025006
DO $$
DECLARE
  result JSON;
  grn_id_to_process UUID;
BEGIN
  -- Get the GRN ID for RIGEGRN09022025006
  SELECT id INTO grn_id_to_process 
  FROM public.grn_header 
  WHERE grn_number = 'RIGEGRN09022025006';
  
  IF grn_id_to_process IS NOT NULL THEN
    -- Process the GRN using the enhanced function
    SELECT public.process_grn_inventory_enhanced(grn_id_to_process) INTO result;
    RAISE NOTICE 'Processing result for RIGEGRN09022025006: %', result;
  ELSE
    RAISE NOTICE 'GRN RIGEGRN09022025006 not found';
  END IF;
END $$;

-- Fix function search path issue for the new functions
CREATE OR REPLACE FUNCTION public.find_and_fix_missing_grn_transactions(p_company_id UUID DEFAULT NULL)
RETURNS TABLE(
  grn_id UUID,
  grn_number TEXT,
  status TEXT,
  missing_transactions INTEGER,
  processing_result JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  grn_rec RECORD;
  expected_transactions INTEGER;
  actual_transactions INTEGER;
  result JSON;
BEGIN
  -- Find GRNs that should have inventory transactions but don't
  FOR grn_rec IN 
    SELECT gh.id, gh.grn_number, gh.status, gh.company_id
    FROM public.grn_header gh
    WHERE (p_company_id IS NULL OR gh.company_id = p_company_id)
      AND gh.status IN ('accepted','received','partially_received')
      AND gh.total_accepted_quantity > 0
  LOOP
    -- Count expected transactions (number of line items with accepted quantity > 0)
    SELECT COUNT(*) INTO expected_transactions
    FROM public.grn_line_items gli
    WHERE gli.grn_header_id = grn_rec.id 
      AND gli.accepted_quantity > 0;
    
    -- Count actual transactions
    SELECT COUNT(*) INTO actual_transactions
    FROM public.inventory_transactions it
    WHERE it.reference_id = grn_rec.id 
      AND it.transaction_type = 'purchase_receipt';
    
    -- If missing transactions, try to fix
    IF actual_transactions < expected_transactions THEN
      SELECT public.process_grn_inventory_enhanced(grn_rec.id) INTO result;
      
      RETURN QUERY SELECT 
        grn_rec.id,
        grn_rec.grn_number,
        grn_rec.status,
        expected_transactions - actual_transactions,
        result;
    END IF;
  END LOOP;
END;
$function$;
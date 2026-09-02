-- Create GRN processing audit log table
CREATE TABLE IF NOT EXISTS public.grn_processing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id UUID NOT NULL,
    grn_number TEXT NOT NULL,
    company_id UUID NOT NULL,
    processing_status TEXT NOT NULL, -- 'started', 'completed', 'failed'
    error_message TEXT,
    items_processed INTEGER DEFAULT 0,
    transactions_created INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID
);

-- Enable RLS on the audit log
ALTER TABLE public.grn_processing_log ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for company isolation
CREATE POLICY "Company isolation for grn_processing_log" 
ON public.grn_processing_log 
FOR ALL 
USING (company_id = user_company_id());

-- Enhanced GRN inventory processing function with detailed logging
CREATE OR REPLACE FUNCTION public.process_grn_inventory_enhanced(p_grn_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  hdr RECORD;
  li RECORD;
  already_processed_qty INTEGER;
  delta_qty INTEGER;
  total_pending INTEGER;
  new_status TEXT;
  items_processed INTEGER := 0;
  transactions_created INTEGER := 0;
  error_msg TEXT;
  log_id UUID;
  result JSON;
BEGIN
  -- Load header; exit if not found
  SELECT * INTO hdr FROM public.grn_header WHERE id = p_grn_id;
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'GRN not found',
      'grn_id', p_grn_id
    );
  END IF;

  -- Create processing log entry
  INSERT INTO public.grn_processing_log (grn_id, grn_number, company_id, processing_status, created_by)
  VALUES (hdr.id, hdr.grn_number, hdr.company_id, 'started', auth.uid())
  RETURNING id INTO log_id;

  BEGIN
    -- Only process when GRN is in a received/accepted state
    IF hdr.status NOT IN ('accepted','received','partially_received') THEN
      UPDATE public.grn_processing_log 
      SET processing_status = 'failed', 
          error_message = 'GRN status not eligible for processing: ' || hdr.status
      WHERE id = log_id;
      
      RETURN json_build_object(
        'success', false,
        'error', 'GRN status not eligible for processing',
        'status', hdr.status,
        'grn_number', hdr.grn_number
      );
    END IF;

    -- For each line item, compute delta between accepted and already processed inventory qty
    FOR li IN 
      SELECT * FROM public.grn_line_items WHERE grn_header_id = p_grn_id
    LOOP
      items_processed := items_processed + 1;
      
      -- Validate warehouse and bin exist
      IF li.warehouse_id IS NULL THEN
        RAISE EXCEPTION 'Missing warehouse_id for item: %', li.product_name;
      END IF;
      
      SELECT COALESCE(SUM(it.quantity_change), 0)
        INTO already_processed_qty
      FROM public.inventory_transactions it
      WHERE it.transaction_type = 'purchase_receipt'
        AND it.reference_id = p_grn_id
        AND it.product_id = li.product_id;

      delta_qty := COALESCE(li.accepted_quantity, 0) - COALESCE(already_processed_qty, 0);

      -- If there is any delta (positive or negative), reconcile inventory and PO item quantities
      IF delta_qty <> 0 THEN
        -- Update product stock
        UPDATE public.products 
        SET stock_quantity = stock_quantity + delta_qty,
            updated_at = now()
        WHERE id = li.product_id;

        -- Update related PO item received/pending using the delta
        UPDATE public.purchase_order_items poi
        SET received_quantity = GREATEST(0, received_quantity + delta_qty),
            pending_quantity = GREATEST(0, quantity - (received_quantity + delta_qty))
        WHERE poi.purchase_order_id = hdr.purchase_order_id
          AND poi.product_id = li.product_id;

        -- Record the inventory transaction for the delta
        PERFORM public.record_inventory_transaction(
          hdr.company_id,
          'purchase_receipt'::transaction_type,
          hdr.id,
          hdr.grn_number,
          li.product_id,
          li.warehouse_id,
          li.bin_id,
          delta_qty,
          li.unit_price,
          'GRN Receipt - ' || hdr.grn_number,
          NULL -- created_by (use auth.uid())
        );
        
        transactions_created := transactions_created + 1;
      END IF;
    END LOOP;

    -- Recompute PO status after adjustments
    SELECT COALESCE(SUM(pending_quantity), 0)
      INTO total_pending
    FROM public.purchase_order_items 
    WHERE purchase_order_id = hdr.purchase_order_id;

    IF total_pending = 0 THEN
      new_status := 'closed';
    ELSIF EXISTS (
      SELECT 1 FROM public.purchase_order_items 
      WHERE purchase_order_id = hdr.purchase_order_id AND received_quantity > 0
    ) THEN
      new_status := 'partially_received';
    ELSE
      new_status := 'open';
    END IF;

    UPDATE public.purchase_orders 
    SET status = new_status,
        updated_at = now()
    WHERE id = hdr.purchase_order_id;

    -- Update processing log with success
    UPDATE public.grn_processing_log 
    SET processing_status = 'completed',
        items_processed = items_processed,
        transactions_created = transactions_created
    WHERE id = log_id;

    result := json_build_object(
      'success', true,
      'grn_number', hdr.grn_number,
      'items_processed', items_processed,
      'transactions_created', transactions_created,
      'po_status', new_status
    );

  EXCEPTION WHEN OTHERS THEN
    error_msg := SQLERRM;
    -- Update processing log with error
    UPDATE public.grn_processing_log 
    SET processing_status = 'failed',
        error_message = error_msg,
        items_processed = items_processed,
        transactions_created = transactions_created
    WHERE id = log_id;
    
    result := json_build_object(
      'success', false,
      'error', error_msg,
      'grn_number', hdr.grn_number,
      'items_processed', items_processed,
      'transactions_created', transactions_created
    );
  END;

  RETURN result;
END;
$function$;

-- Enhanced trigger function with better error handling
CREATE OR REPLACE FUNCTION public.trg_process_grn_inventory_enhanced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  -- Only process on INSERT with accepted status or UPDATE to accepted status
  IF (TG_OP = 'INSERT' AND NEW.status IN ('accepted','received','partially_received')) OR
     (TG_OP = 'UPDATE' AND NEW.status IN ('accepted','received','partially_received') AND 
      (OLD.status IS NULL OR OLD.status NOT IN ('accepted','received','partially_received'))) THEN
    
    -- Call the enhanced processing function
    SELECT public.process_grn_inventory_enhanced(NEW.id) INTO result;
    
    -- Log any failures (success is already logged in the function)
    IF NOT (result->>'success')::boolean THEN
      RAISE WARNING 'GRN processing failed for %: %', NEW.grn_number, result->>'error';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Replace the old trigger with the enhanced one
DROP TRIGGER IF EXISTS trg_grn_inventory_processing ON public.grn_header;
CREATE TRIGGER trg_grn_inventory_processing_enhanced
  AFTER INSERT OR UPDATE OF status ON public.grn_header
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_process_grn_inventory_enhanced();

-- Manual recovery function to find and fix GRNs with missing inventory transactions
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

-- Process the specific missing GRN that was identified
DO $$
DECLARE
  result JSON;
BEGIN
  -- Process RIGEGRN09022025006
  SELECT public.process_grn_inventory_enhanced(
    (SELECT id FROM public.grn_header WHERE grn_number = 'RIGEGRN09022025006')
  ) INTO result;
  
  RAISE NOTICE 'Processing result for RIGEGRN09022025006: %', result;
END $$;
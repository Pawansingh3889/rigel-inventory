-- Create function to process credit note inventory transactions
CREATE OR REPLACE FUNCTION public.process_credit_note_inventory(p_credit_note_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  credit_note_record RECORD;
  item_record RECORD;
  v_items_processed INTEGER := 0;
  v_transactions_created INTEGER := 0;
  error_msg TEXT;
  result JSON;
BEGIN
  -- Get credit note details
  SELECT * INTO credit_note_record FROM public.credit_notes WHERE id = p_credit_note_id;
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Credit note not found',
      'credit_note_id', p_credit_note_id
    );
  END IF;

  -- Only process confirmed credit notes
  IF credit_note_record.status != 'Confirmed' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Credit note is not confirmed',
      'status', credit_note_record.status
    );
  END IF;

  BEGIN
    -- Process each credit note item with return quantity > 0
    FOR item_record IN 
      SELECT * FROM public.credit_note_items 
      WHERE credit_note_id = p_credit_note_id AND return_qty > 0
    LOOP
      v_items_processed := v_items_processed + 1;
      
      -- Check if inventory transaction already exists to avoid duplicates
      IF NOT EXISTS (
        SELECT 1 FROM public.inventory_transactions 
        WHERE reference_id = p_credit_note_id 
        AND product_id = item_record.product_id
        AND transaction_type = 'sales_return'
      ) THEN
        -- Record inventory transaction for credit note return
        PERFORM public.record_inventory_transaction(
          credit_note_record.company_id,
          'sales_return'::transaction_type,
          p_credit_note_id,
          credit_note_record.cn_number,
          item_record.product_id,
          item_record.warehouse_id,
          item_record.bin_id,
          item_record.return_qty, -- Positive quantity for returns
          item_record.unit_price,
          'Credit Note Return - ' || item_record.product_name || ' (' || item_record.return_qty || ' units)',
          credit_note_record.created_by
        );
        
        v_transactions_created := v_transactions_created + 1;
      END IF;
    END LOOP;

    -- Update product stock quantities based on inventory transactions
    FOR item_record IN 
      SELECT DISTINCT product_id, warehouse_id, bin_id 
      FROM public.credit_note_items 
      WHERE credit_note_id = p_credit_note_id AND return_qty > 0
    LOOP
      -- Calculate actual stock from inventory transactions
      UPDATE public.products 
      SET stock_quantity = (
        SELECT COALESCE(SUM(quantity_change), 0) 
        FROM public.inventory_transactions 
        WHERE company_id = credit_note_record.company_id 
        AND product_id = item_record.product_id
      ),
      updated_at = now()
      WHERE id = item_record.product_id;
    END LOOP;

    result := json_build_object(
      'success', true,
      'credit_note_number', credit_note_record.cn_number,
      'items_processed', v_items_processed,
      'transactions_created', v_transactions_created
    );

  EXCEPTION WHEN OTHERS THEN
    error_msg := SQLERRM;
    result := json_build_object(
      'success', false,
      'error', error_msg,
      'credit_note_number', credit_note_record.cn_number,
      'items_processed', v_items_processed,
      'transactions_created', v_transactions_created
    );
  END;

  RETURN result;
END;
$$;

-- Create trigger function to handle credit note status changes
CREATE OR REPLACE FUNCTION public.handle_credit_note_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  processing_result JSON;
BEGIN
  -- Process inventory when status changes to Confirmed
  IF TG_OP = 'UPDATE' AND NEW.status = 'Confirmed' AND 
     (OLD.status IS NULL OR OLD.status != 'Confirmed') THEN
    
    -- Process inventory transactions
    SELECT public.process_credit_note_inventory(NEW.id) INTO processing_result;
    
    -- Log the result (optional - you can remove this if you don't want logging)
    IF NOT (processing_result->>'success')::boolean THEN
      RAISE WARNING 'Credit note inventory processing failed for %: %', 
        NEW.cn_number, processing_result->>'error';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on credit_notes table
DROP TRIGGER IF EXISTS trg_credit_note_status_change ON public.credit_notes;
CREATE TRIGGER trg_credit_note_status_change
  AFTER INSERT OR UPDATE ON public.credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_credit_note_status_change();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.process_credit_note_inventory(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_credit_note_status_change() TO authenticated;
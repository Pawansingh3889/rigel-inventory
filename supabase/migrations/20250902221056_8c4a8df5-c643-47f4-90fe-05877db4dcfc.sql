-- Fix the trigger function that's causing the grn_header_id error
-- The issue is in trg_process_grn_inventory trying to reference grn_header_id on grn_header table

CREATE OR REPLACE FUNCTION public.trg_process_grn_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- This function should only be called from grn_line_items table
  -- For grn_header table operations, use trg_process_grn_inventory_enhanced instead
  
  IF TG_TABLE_NAME = 'grn_line_items' THEN
    -- Use the GRN header id from the line item row
    PERFORM public.process_grn_inventory(COALESCE(NEW.grn_header_id, OLD.grn_header_id));
    RETURN COALESCE(NEW, OLD);
  ELSE
    -- This function was called from wrong table, just return the record
    RAISE WARNING 'trg_process_grn_inventory called from table %, expected grn_line_items', TG_TABLE_NAME;
    RETURN COALESCE(NEW, OLD);
  END IF;
END;
$function$;
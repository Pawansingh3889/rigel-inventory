-- Fix security linter warnings by adding search_path to functions that need it

-- Fix 1: handle_grn_inventory_updates function
CREATE OR REPLACE FUNCTION public.handle_grn_inventory_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    item_record RECORD;
    grn_header_record RECORD;
    pending_qty_before INTEGER;
    total_pending_qty INTEGER := 0;
    should_process_inventory BOOLEAN := false;
BEGIN
    -- Determine if we should process inventory transactions
    IF TG_OP = 'INSERT' AND NEW.status IN ('accepted', 'received', 'partially_received') THEN
        should_process_inventory := true;
    ELSIF TG_OP = 'UPDATE' AND NEW.status IN ('accepted', 'received', 'partially_received')
          AND (OLD.status IS NULL OR OLD.status NOT IN ('accepted', 'received', 'partially_received')) THEN
        should_process_inventory := true;
    END IF;

    IF should_process_inventory THEN
        grn_header_record := NEW;
        
        FOR item_record IN 
            SELECT * FROM public.grn_line_items 
            WHERE grn_header_id = NEW.id AND accepted_quantity > 0
        LOOP
            -- Validate that accepted quantity doesn't exceed pending quantity
            SELECT pending_quantity
            INTO pending_qty_before
            FROM public.purchase_order_items 
            WHERE purchase_order_id = grn_header_record.purchase_order_id 
              AND product_id = item_record.product_id;

            IF pending_qty_before IS NULL THEN
                pending_qty_before := 0;
            END IF;

            IF item_record.accepted_quantity > pending_qty_before THEN
                RAISE EXCEPTION 'Accepted quantity (%) exceeds available pending quantity (%) for product %', 
                    item_record.accepted_quantity, pending_qty_before, item_record.product_name;
            END IF;
            
            -- Update product stock
            UPDATE public.products 
            SET stock_quantity = stock_quantity + item_record.accepted_quantity,
                updated_at = now()
            WHERE id = item_record.product_id;
            
            -- Record inventory transaction; pass NULL for created_by to use auth.uid()
            PERFORM public.record_inventory_transaction(
                grn_header_record.company_id,
                'purchase_receipt'::transaction_type,
                NEW.id,
                grn_header_record.grn_number,
                item_record.product_id,
                item_record.warehouse_id,
                item_record.bin_id,
                item_record.accepted_quantity,
                item_record.unit_price,
                'GRN Receipt - ' || grn_header_record.grn_number,
                NULL  -- created_by
            );
            
            -- Update PO line items
            UPDATE public.purchase_order_items 
            SET received_quantity = received_quantity + item_record.accepted_quantity,
                pending_quantity = GREATEST(0, quantity - (received_quantity + item_record.accepted_quantity)),
                updated_at = now()
            WHERE purchase_order_id = grn_header_record.purchase_order_id 
              AND product_id = item_record.product_id;
        END LOOP;
        
        -- Update PO status based on pending quantities
        SELECT COALESCE(SUM(pending_quantity), 0) INTO total_pending_qty
        FROM public.purchase_order_items 
        WHERE purchase_order_id = grn_header_record.purchase_order_id;

        UPDATE public.purchase_orders 
        SET status = CASE 
            WHEN total_pending_qty = 0 THEN 'closed'
            WHEN EXISTS (
                SELECT 1 FROM public.purchase_order_items 
                WHERE purchase_order_id = grn_header_record.purchase_order_id 
                  AND received_quantity > 0
            ) THEN 'partially_received'
            ELSE status
        END,
        updated_at = now()
        WHERE id = grn_header_record.purchase_order_id;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Fix 2: handle_new_user function  
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

-- Fix 3: log_transaction_audit function
CREATE OR REPLACE FUNCTION public.log_transaction_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO transaction_audit_log (
    table_name,
    record_id,
    action,
    user_id,
    company_id,
    old_values,
    new_values
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    auth.uid(),
    COALESCE(NEW.company_id, OLD.company_id),
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Fix 4: auto_set_invoice_fields function
CREATE OR REPLACE FUNCTION public.auto_set_invoice_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.status = 'invoiced' THEN
    IF NEW.performa_invoice_number IS NULL OR NEW.performa_invoice_number = '' THEN
      NEW.performa_invoice_number := public.generate_company_invoice_number(NEW.company_id);
    END IF;

    IF NEW.performa_invoice_date IS NULL THEN
      NEW.performa_invoice_date := CURRENT_DATE;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
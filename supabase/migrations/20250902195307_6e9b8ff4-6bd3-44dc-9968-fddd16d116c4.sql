-- Retroactive fix for existing GRN RIGEGRN09022025001
-- This will manually trigger the inventory processing for the existing GRN

DO $$ 
DECLARE
    grn_id uuid;
BEGIN
    -- Get the GRN ID
    SELECT id INTO grn_id 
    FROM grn_header 
    WHERE grn_number = 'RIGEGRN09022025001' AND status = 'accepted';
    
    IF grn_id IS NOT NULL THEN
        -- Manually trigger the inventory update function
        UPDATE grn_header 
        SET updated_at = now() 
        WHERE id = grn_id;
        
        RAISE LOG 'Retroactive fix applied for GRN: RIGEGRN09022025001';
    END IF;
END $$;
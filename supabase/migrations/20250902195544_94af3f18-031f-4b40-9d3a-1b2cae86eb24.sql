-- Manually trigger the inventory update for the existing GRN
-- by changing status to draft and back to accepted
UPDATE grn_header 
SET status = 'draft', updated_at = now()
WHERE grn_number = 'RIGEGRN09022025001';

-- Now change it back to accepted to trigger the inventory processing
UPDATE grn_header 
SET status = 'accepted', updated_at = now()
WHERE grn_number = 'RIGEGRN09022025001';
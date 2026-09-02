-- Re-run the status toggle to trigger inventory processing again
UPDATE grn_header 
SET status = 'draft', updated_at = now()
WHERE grn_number = 'RIGEGRN09022025001';

UPDATE grn_header 
SET status = 'accepted', updated_at = now()
WHERE grn_number = 'RIGEGRN09022025001';
-- Add grn_reference_no field to grn_header table
ALTER TABLE grn_header ADD COLUMN grn_reference_no text;

-- Update existing GRNs to have a reference number based on their GRN number
UPDATE grn_header SET grn_reference_no = grn_number WHERE grn_reference_no IS NULL;
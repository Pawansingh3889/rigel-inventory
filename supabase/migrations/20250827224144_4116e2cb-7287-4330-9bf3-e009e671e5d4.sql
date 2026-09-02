-- Add comprehensive supplier fields to match the requirements
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS pan_number TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS pin_code TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS bank_address TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS ifsc_code TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS account_type TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS vendor_registered_address TEXT;

-- Add constraints for data validation
ALTER TABLE public.suppliers ADD CONSTRAINT check_account_type 
  CHECK (account_type IN ('saving', 'current') OR account_type IS NULL);

-- Add comments for clarity
COMMENT ON COLUMN public.suppliers.gst_number IS 'GST registration number';
COMMENT ON COLUMN public.suppliers.pan_number IS 'PAN card number';
COMMENT ON COLUMN public.suppliers.pin_code IS 'Postal/PIN code';
COMMENT ON COLUMN public.suppliers.ifsc_code IS 'Bank IFSC code';
COMMENT ON COLUMN public.suppliers.account_number IS 'Bank account number';
COMMENT ON COLUMN public.suppliers.account_type IS 'Account type: saving or current';
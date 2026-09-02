-- Add new fields to suppliers table for enhanced address management
ALTER TABLE public.suppliers 
ADD COLUMN address_line1 TEXT,
ADD COLUMN address_line2 TEXT,
ADD COLUMN place_of_supply TEXT,
ADD COLUMN credit_time INTEGER, -- Credit time in days
ADD COLUMN dispatch_address_line1 TEXT,
ADD COLUMN dispatch_address_line2 TEXT,
ADD COLUMN dispatch_city TEXT,
ADD COLUMN dispatch_state TEXT,
ADD COLUMN dispatch_country TEXT,
ADD COLUMN dispatch_pin_code TEXT,
ADD COLUMN same_as_registered_address BOOLEAN DEFAULT false;

-- Update existing data to move vendor_registered_address to address_line1
UPDATE public.suppliers 
SET address_line1 = vendor_registered_address 
WHERE vendor_registered_address IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.suppliers.credit_time IS 'Credit time in days';
COMMENT ON COLUMN public.suppliers.same_as_registered_address IS 'Whether dispatch address is same as registered address';
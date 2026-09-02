-- Add unique constraint for supplier reference
ALTER TABLE public.suppliers 
ADD CONSTRAINT suppliers_supplier_ref_unique UNIQUE (supplier_ref);
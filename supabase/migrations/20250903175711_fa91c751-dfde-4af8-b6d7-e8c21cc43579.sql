-- Fix the constraint issue for inventory_transactions
-- The function needs a proper constraint, not just an index

-- Drop the existing index if it exists
DROP INDEX IF EXISTS public.uq_inventory_tx_unique_ref;

-- Create a proper unique constraint with the same name
ALTER TABLE public.inventory_transactions 
ADD CONSTRAINT uq_inventory_tx_unique_ref 
UNIQUE (company_id, reference_id, product_id, transaction_type);
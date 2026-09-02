-- Add foreign key constraints to inventory_transactions table
ALTER TABLE public.inventory_transactions 
ADD CONSTRAINT fk_inventory_transactions_product_id 
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.inventory_transactions 
ADD CONSTRAINT fk_inventory_transactions_warehouse_id 
FOREIGN KEY (warehouse_id) REFERENCES public.warehouse_bins(id) ON DELETE CASCADE;

ALTER TABLE public.inventory_transactions 
ADD CONSTRAINT fk_inventory_transactions_bin_id 
FOREIGN KEY (bin_id) REFERENCES public.warehouse_bins(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_transactions 
ADD CONSTRAINT fk_inventory_transactions_created_by 
FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;
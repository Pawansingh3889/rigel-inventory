-- Add missing default warehouse and bin columns to sales_invoices table
ALTER TABLE public.sales_invoices 
ADD COLUMN default_warehouse_id uuid REFERENCES public.warehouse_bins(warehouse_id),
ADD COLUMN default_bin_id uuid REFERENCES public.warehouse_bins(id);
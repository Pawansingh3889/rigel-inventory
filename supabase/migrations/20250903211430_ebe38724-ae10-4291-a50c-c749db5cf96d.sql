-- Add missing default bin column to sales_invoices table
ALTER TABLE public.sales_invoices 
ADD COLUMN default_bin_id uuid REFERENCES public.warehouse_bins(id);
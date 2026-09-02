-- Remove overly restrictive unique constraint that prevented multiple bins per warehouse
ALTER TABLE public.warehouse_bins DROP CONSTRAINT IF EXISTS warehouse_bins_unique_warehouse;
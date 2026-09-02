-- Add missing columns to public.warehouse_bins to match UI fields
ALTER TABLE public.warehouse_bins
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_person_email text;
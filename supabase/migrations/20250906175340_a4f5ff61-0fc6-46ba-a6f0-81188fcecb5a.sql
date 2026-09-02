-- Add production_ready field to bom_headers table
ALTER TABLE public.bom_headers 
ADD COLUMN IF NOT EXISTS production_ready BOOLEAN NOT NULL DEFAULT false;
-- Add new columns to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS full_address TEXT,
ADD COLUMN IF NOT EXISTS gstn_number TEXT;

-- Add INSERT policy for businesses table so users can register their business
CREATE POLICY "Users can register their business" 
ON public.businesses 
FOR INSERT 
WITH CHECK (true);
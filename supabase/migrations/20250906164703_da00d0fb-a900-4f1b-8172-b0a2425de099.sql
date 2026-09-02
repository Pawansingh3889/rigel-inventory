-- Fix RLS policy for warehouse_bins to use the correct company filtering
DROP POLICY IF EXISTS "Company isolation for warehouse_bins" ON public.warehouse_bins;

CREATE POLICY "Company isolation for warehouse_bins" 
ON public.warehouse_bins
FOR ALL 
USING (
  company_id IN (
    SELECT company_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
);
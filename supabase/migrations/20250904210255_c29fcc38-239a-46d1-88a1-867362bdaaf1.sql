-- Drop and recreate the view without security definer to fix security warning
DROP VIEW IF EXISTS public.credit_note_stats;

-- Recreate view as a regular view (not security definer)
CREATE VIEW public.credit_note_stats AS
SELECT 
    company_id,
    COUNT(CASE WHEN status = 'Draft' THEN 1 END) as draft_count,
    COALESCE(SUM(CASE WHEN status = 'Draft' THEN total_amount ELSE 0 END), 0) as draft_amount,
    COUNT(CASE WHEN status = 'Confirmed' THEN 1 END) as confirmed_count,
    COALESCE(SUM(CASE WHEN status = 'Confirmed' THEN total_amount ELSE 0 END), 0) as confirmed_amount
FROM public.credit_notes
GROUP BY company_id;

-- Enable RLS on the view
ALTER VIEW public.credit_note_stats SET (security_invoker = true);

-- Create RLS policy for the view access
CREATE POLICY "Company isolation for credit_note_stats" 
ON public.credit_notes 
FOR SELECT 
USING (company_id = user_company_id());
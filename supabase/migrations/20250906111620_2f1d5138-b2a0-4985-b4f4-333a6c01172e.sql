-- Add payment type and status fields to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'regular' CHECK (payment_type IN ('advance', 'regular', 'final')),
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'completed' CHECK (payment_status IN ('pending', 'completed', 'cancelled')),
ADD COLUMN IF NOT EXISTS grn_id UUID REFERENCES public.grn_header(id),
ADD COLUMN IF NOT EXISTS sales_invoice_id UUID REFERENCES public.sales_invoices(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payments_grn_id ON public.payments(grn_id);
CREATE INDEX IF NOT EXISTS idx_payments_sales_invoice_id ON public.payments(sales_invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON public.payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_type_status ON public.payments(payment_type, payment_status);

-- Update RLS policies for payments table to ensure company isolation
DROP POLICY IF EXISTS "Company isolation" ON public.payments;
CREATE POLICY "Company isolation for payments" 
ON public.payments 
FOR ALL 
USING (company_id = user_company_id());
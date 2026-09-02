-- Create performa_invoices table
CREATE TABLE public.performa_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  sales_order_id UUID NOT NULL,
  performa_invoice_number TEXT NOT NULL,
  performa_invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  subtotal_amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create performa_invoice_items table
CREATE TABLE public.performa_invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  performa_invoice_id UUID NOT NULL,
  product_id UUID NOT NULL,
  item_description TEXT NOT NULL DEFAULT '',
  hsn_sac_code TEXT,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  discount_percentage NUMERIC DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  tax_percentage NUMERIC DEFAULT 0,
  cgst_rate NUMERIC DEFAULT 0,
  sgst_rate NUMERIC DEFAULT 0,
  igst_rate NUMERIC DEFAULT 0,
  cgst_amount NUMERIC DEFAULT 0,
  sgst_amount NUMERIC DEFAULT 0,
  igst_amount NUMERIC DEFAULT 0,
  total_price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.performa_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performa_invoice_items ENABLE ROW LEVEL SECURITY;

-- Create policies for performa_invoices
CREATE POLICY "Company isolation for performa_invoices" 
ON public.performa_invoices 
FOR ALL 
USING (company_id = user_company_id());

-- Create policies for performa_invoice_items
CREATE POLICY "Performa invoice items access" 
ON public.performa_invoice_items 
FOR ALL 
USING (performa_invoice_id IN (
  SELECT id FROM public.performa_invoices 
  WHERE company_id = user_company_id()
));

-- Create function to generate performa invoice number
CREATE OR REPLACE FUNCTION public.generate_performa_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    date_part TEXT;
    performa_number TEXT;
BEGIN
    -- Get current date in MMDDYYYY format
    date_part := to_char(now(), 'MMDDYYYY');
    
    -- Generate performa invoice number
    performa_number := 'P' || date_part;
    
    RETURN performa_number;
END;
$function$;

-- Create trigger for auto-generating performa invoice numbers
CREATE OR REPLACE FUNCTION public.auto_generate_performa_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.performa_invoice_number IS NULL OR NEW.performa_invoice_number = '' THEN
        NEW.performa_invoice_number := generate_performa_invoice_number();
    END IF;
    RETURN NEW;
END;
$function$;

-- Create trigger for performa_invoices
CREATE TRIGGER trigger_auto_generate_performa_invoice_number
BEFORE INSERT ON public.performa_invoices
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_performa_invoice_number();

-- Add updated_at trigger for performa_invoices
CREATE TRIGGER update_performa_invoices_updated_at
BEFORE UPDATE ON public.performa_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
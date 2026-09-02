-- Create warehouse_bins table
CREATE TABLE public.warehouse_bins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  wh_bin_code VARCHAR(4) NOT NULL,
  bin_name VARCHAR(10) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT warehouse_bins_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  CONSTRAINT warehouse_bins_wh_bin_code_check CHECK (LENGTH(wh_bin_code) = 4 AND wh_bin_code ~ '^[A-Z0-9]+$'),
  CONSTRAINT warehouse_bins_bin_name_check CHECK (LENGTH(bin_name) <= 10 AND bin_name ~ '^[A-Za-z]+$'),
  CONSTRAINT warehouse_bins_unique_company_code UNIQUE (company_id, wh_bin_code)
);

-- Enable RLS
ALTER TABLE public.warehouse_bins ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for company isolation
CREATE POLICY "Company isolation for warehouse_bins" 
ON public.warehouse_bins 
FOR ALL 
USING (company_id = user_company_id());

-- Create updated_at trigger
CREATE TRIGGER update_warehouse_bins_updated_at
  BEFORE UPDATE ON public.warehouse_bins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_warehouse_bins_company_id ON public.warehouse_bins(company_id);
CREATE INDEX idx_warehouse_bins_wh_bin_code ON public.warehouse_bins(company_id, wh_bin_code);
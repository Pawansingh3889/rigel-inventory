-- Create multi-tenant ERP database schema

-- Create app roles enum
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'manager', 'staff');

-- Create company status enum  
CREATE TYPE public.company_status AS ENUM ('active', 'inactive', 'suspended');

-- Create companies table (tenant isolation)
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  status company_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  role app_role NOT NULL DEFAULT 'staff',
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product categories table
CREATE TABLE public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table for inventory
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER NOT NULL DEFAULT 0,
  max_stock_level INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, sku)
);

-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  contact_person TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  contact_person TEXT,
  credit_limit DECIMAL(12,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create purchase orders table
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  po_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, po_number)
);

-- Create purchase order items table
CREATE TABLE public.purchase_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  received_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sales orders table
CREATE TABLE public.sales_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, order_number)
);

-- Create sales order items table
CREATE TABLE public.sales_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for companies
CREATE POLICY "Users can view their own company" ON public.companies
  FOR SELECT USING (
    id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can update their company" ON public.companies
  FOR UPDATE USING (
    id IN (
      SELECT company_id FROM public.profiles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Create RLS policies for profiles
CREATE POLICY "Users can view profiles in their company" ON public.profiles
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage profiles in their company" ON public.profiles
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.profiles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Create function for company-based RLS
CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Create RLS policies for all other tables (company isolation)
CREATE POLICY "Company isolation" ON public.product_categories
  FOR ALL USING (company_id = public.user_company_id());

CREATE POLICY "Company isolation" ON public.products
  FOR ALL USING (company_id = public.user_company_id());

CREATE POLICY "Company isolation" ON public.suppliers
  FOR ALL USING (company_id = public.user_company_id());

CREATE POLICY "Company isolation" ON public.customers
  FOR ALL USING (company_id = public.user_company_id());

CREATE POLICY "Company isolation" ON public.purchase_orders
  FOR ALL USING (company_id = public.user_company_id());

CREATE POLICY "Company isolation" ON public.sales_orders
  FOR ALL USING (company_id = public.user_company_id());

CREATE POLICY "Company isolation" ON public.payments
  FOR ALL USING (company_id = public.user_company_id());

-- Create policies for order items (through parent tables)
CREATE POLICY "Purchase order items access" ON public.purchase_order_items
  FOR ALL USING (
    purchase_order_id IN (
      SELECT id FROM public.purchase_orders WHERE company_id = public.user_company_id()
    )
  );

CREATE POLICY "Sales order items access" ON public.sales_order_items
  FOR ALL USING (
    sales_order_id IN (
      SELECT id FROM public.sales_orders WHERE company_id = public.user_company_id()
    )
  );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_orders_updated_at
  BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
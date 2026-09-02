-- Add missing fields to purchase_order_items table for complete form field mapping
-- These fields exist in the form but might not be in the database

-- Add cgst_rate column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_order_items' 
                   AND column_name = 'cgst_rate') THEN
        ALTER TABLE public.purchase_order_items 
        ADD COLUMN cgst_rate NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Add sgst_rate column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_order_items' 
                   AND column_name = 'sgst_rate') THEN
        ALTER TABLE public.purchase_order_items 
        ADD COLUMN sgst_rate NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Add igst_rate column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_order_items' 
                   AND column_name = 'igst_rate') THEN
        ALTER TABLE public.purchase_order_items 
        ADD COLUMN igst_rate NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Add is_taxable column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_order_items' 
                   AND column_name = 'is_taxable') THEN
        ALTER TABLE public.purchase_order_items 
        ADD COLUMN is_taxable BOOLEAN DEFAULT true;
    END IF;
END $$;
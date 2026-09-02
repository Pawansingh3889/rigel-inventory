-- First, check if sales_invoice transaction type exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
        -- Create the enum if it doesn't exist (shouldn't happen in this case)
        CREATE TYPE transaction_type AS ENUM ('purchase_order', 'sales_order', 'inventory_adjustment', 'purchase_receipt', 'sales_invoice', 'stock_transfer');
    ELSE
        -- Add sales_invoice to existing enum if not present
        BEGIN
            ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'sales_invoice';
        EXCEPTION WHEN duplicate_object THEN
            -- Value already exists, do nothing
            NULL;
        END;
    END IF;
END $$;
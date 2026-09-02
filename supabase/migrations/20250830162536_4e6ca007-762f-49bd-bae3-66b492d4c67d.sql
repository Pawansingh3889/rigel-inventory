-- Enhance business_users table for better user management
ALTER TABLE business_users 
ADD COLUMN password_hash TEXT,
ADD COLUMN created_by UUID REFERENCES auth.users(id),
ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;

-- Update access_sections to store permission levels (read/edit) per section
-- Structure: {"inventory": "read", "sales": "edit", "purchases": "read"}
COMMENT ON COLUMN business_users.access_sections IS 'JSON object storing section permissions: {"section_name": "read|edit"}';

-- Create audit log table for transaction tracking
CREATE TABLE transaction_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  user_id UUID REFERENCES auth.users(id),
  company_id UUID REFERENCES companies(id),
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE transaction_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy for audit log access (only admins can view)
CREATE POLICY "Admins can view audit logs"
ON transaction_audit_log
FOR SELECT
USING (company_id = user_company_id() AND is_user_admin());

-- Policy for system to insert audit logs
CREATE POLICY "System can insert audit logs"
ON transaction_audit_log
FOR INSERT
WITH CHECK (true);

-- Function to log transactions
CREATE OR REPLACE FUNCTION log_transaction_audit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO transaction_audit_log (
    table_name,
    record_id,
    action,
    user_id,
    company_id,
    old_values,
    new_values
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    auth.uid(),
    COALESCE(NEW.company_id, OLD.company_id),
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit triggers to key tables
CREATE TRIGGER audit_customers AFTER INSERT OR UPDATE OR DELETE ON customers FOR EACH ROW EXECUTE FUNCTION log_transaction_audit();
CREATE TRIGGER audit_suppliers AFTER INSERT OR UPDATE OR DELETE ON suppliers FOR EACH ROW EXECUTE FUNCTION log_transaction_audit();
CREATE TRIGGER audit_products AFTER INSERT OR UPDATE OR DELETE ON products FOR EACH ROW EXECUTE FUNCTION log_transaction_audit();
CREATE TRIGGER audit_sales_orders AFTER INSERT OR UPDATE OR DELETE ON sales_orders FOR EACH ROW EXECUTE FUNCTION log_transaction_audit();
CREATE TRIGGER audit_purchase_orders AFTER INSERT OR UPDATE OR DELETE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION log_transaction_audit();
CREATE TRIGGER audit_purchase_invoices AFTER INSERT OR UPDATE OR DELETE ON purchase_invoices FOR EACH ROW EXECUTE FUNCTION log_transaction_audit();
CREATE TRIGGER audit_performa_invoices AFTER INSERT OR UPDATE OR DELETE ON performa_invoices FOR EACH ROW EXECUTE FUNCTION log_transaction_audit();
CREATE TRIGGER audit_payments AFTER INSERT OR UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION log_transaction_audit();
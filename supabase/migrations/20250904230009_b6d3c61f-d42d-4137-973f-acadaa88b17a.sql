-- Enable leaked password protection for better security
-- This prevents users from using passwords that have been exposed in data breaches

-- Enable password strength validation and leaked password protection
INSERT INTO auth.config (parameter, value) 
VALUES 
  ('password_min_length', '8'),
  ('password_require_uppercase', 'true'),
  ('password_require_lowercase', 'true'), 
  ('password_require_numbers', 'true'),
  ('password_require_symbols', 'false'),
  ('password_enable_hibp', 'true')
ON CONFLICT (parameter) DO UPDATE SET 
  value = EXCLUDED.value;
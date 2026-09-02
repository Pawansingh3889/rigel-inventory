-- Activate the inactive business user
UPDATE company_users 
SET status = 'ACTIVE' 
WHERE email = 'riddhikapkoti1@gmail.com' AND status = 'INACTIVE';

-- Also check if riddhikapkoti2@gmail.com exists and activate if needed
UPDATE company_users 
SET status = 'ACTIVE' 
WHERE email = 'riddhikapkoti2@gmail.com' AND status = 'INACTIVE';
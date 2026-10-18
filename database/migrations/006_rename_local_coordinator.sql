-- Local demo display identity only. The existing demo login remains unchanged.
UPDATE users
SET display_name = 'Saurav Demo'
WHERE email = 'coordinator.demo@crisisgrid.local';

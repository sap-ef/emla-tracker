-- Update script for BTP Onboarding Advisor sessions assigned to eduardo.fagnudes@sap.com
-- Updates ONBSESSION_DB_SESSIONS table with data from EMLACustomers

-- Update TP2 Sessions (Public)
UPDATE ONBSESSION_DB_SESSIONS os
SET 
  os.ONBADVASSIGNDATE = ec.btpOnbAdvAssignedOn,
  os.CONTRACTSKU = ec.productSKU,
  os.CONTRACTSTARTDATE = ec.startDate
FROM EMSLATRACKER_EMLACUSTOMERS ec
WHERE 
  ec.btpOnbAdvEmail = 'eduardo.fagnudes@sap.com'
  AND ec.trackAppTP2 IS NOT NULL
  AND os.IP = ec.trackAppTP2;

-- Update TP2 Sessions (Integration Suite)
UPDATE ONBSESSION_DB_SESSIONS os
SET 
  os.ONBADVASSIGNDATE = ec.btpOnbAdvAssignedOn,
  os.CONTRACTSKU = ec.productSKU,
  os.CONTRACTSTARTDATE = ec.startDate
FROM EMSLATRACKER_EMLACUSTOMERS ec
WHERE 
  ec.btpOnbAdvEmail = 'eduardo.fagnudes@sap.com'
  AND ec.trackAppTP2 IS NOT NULL
  AND os.IP = ec.trackAppTP2
  AND os.ENVIRONMENT = 'Integration Suite';

-- Update TP1 Sessions (Public)
UPDATE ONBSESSION_DB_SESSIONS os
SET 
  os.ONBADVASSIGNDATE = ec.btpOnbAdvAssignedOn,
  os.CONTRACTSKU = ec.productSKU,
  os.CONTRACTSTARTDATE = ec.startDate
FROM EMSLATRACKER_EMLACUSTOMERS ec
WHERE 
  ec.btpOnbAdvEmail = 'eduardo.fagnudes@sap.com'
  AND ec.trackApp IS NOT NULL
  AND os.IP = ec.trackApp;

-- Update TP1 Sessions (Integration Suite)
UPDATE ONBSESSION_DB_SESSIONS os
SET 
  os.ONBADVASSIGNDATE = ec.btpOnbAdvAssignedOn,
  os.CONTRACTSKU = ec.productSKU,
  os.CONTRACTSTARTDATE = ec.startDate
FROM EMSLATRACKER_EMLACUSTOMERS ec
WHERE 
  ec.btpOnbAdvEmail = 'eduardo.fagnudes@sap.com'
  AND ec.trackApp IS NOT NULL
  AND os.IP = ec.trackApp
  AND os.ENVIRONMENT = 'Integration Suite';

-- Update SH Sessions (Public)
UPDATE ONBSESSION_DB_SESSIONS os
SET 
  os.ONBADVASSIGNDATE = ec.btpOnbAdvAssignedOn,
  os.CONTRACTSKU = ec.productSKU,
  os.CONTRACTSTARTDATE = ec.startDate
FROM EMSLATRACKER_EMLACUSTOMERS ec
WHERE 
  ec.btpOnbAdvEmail = 'eduardo.fagnudes@sap.com'
  AND ec.trackAppSH IS NOT NULL
  AND os.IP = ec.trackAppSH;

-- Update SH Sessions (Integration Suite)
UPDATE ONBSESSION_DB_SESSIONS os
SET 
  os.ONBADVASSIGNDATE = ec.btpOnbAdvAssignedOn,
  os.CONTRACTSKU = ec.productSKU,
  os.CONTRACTSTARTDATE = ec.startDate
FROM EMSLATRACKER_EMLACUSTOMERS ec
WHERE 
  ec.btpOnbAdvEmail = 'eduardo.fagnudes@sap.com'
  AND ec.trackAppSH IS NOT NULL
  AND os.IP = ec.trackAppSH
  AND os.ENVIRONMENT = 'Integration Suite';

-- Query to verify the updates (select only, no update)
SELECT 
  ec.btpOnbAdvEmail,
  ec.trackApp,
  ec.trackAppTP2,
  ec.trackAppSH,
  ec.btpOnbAdvAssignedOn,
  ec.productSKU,
  ec.startDate,
  os.IP,
  os.ENVIRONMENT
FROM EMSLATRACKER_EMLACUSTOMERS ec
LEFT JOIN ONBSESSION_DB_SESSIONS os 
  ON (os.IP = ec.trackApp OR os.IP = ec.trackAppTP2 OR os.IP = ec.trackAppSH)
WHERE ec.btpOnbAdvEmail = 'eduardo.fagnudes@sap.com'
ORDER BY ec.trackApp, ec.trackAppTP2, ec.trackAppSH;

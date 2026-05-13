-- Script de verificação para recuperar dados necessários para o update
-- Busca todos os registros de eduardo.fagnudes@sap.com

-- 1. Verificar dados na tabela EMLACustomers para o advisor
SELECT 
  ID,
  externalID,
  customerName,
  btpOnbAdvEmail,
  trackApp,
  trackAppTP2,
  trackAppSH,
  btpOnbAdvAssignedOn,
  productSKU,
  startDate
FROM EMSLATRACKER_EMLACUSTOMERS
WHERE btpOnbAdvEmail = 'eduardo.fagnudes@sap.com'
  AND (trackApp IS NOT NULL 
    OR trackAppTP2 IS NOT NULL 
    OR trackAppSH IS NOT NULL);

-- 2. Verificar se os IPs dos trackApps existem na tabela ONBSESSION_DB_SESSIONS
SELECT 
  *
FROM ONBSESSION_DB_SESSIONS os
WHERE os.IP IN (
  SELECT trackApp FROM EMSLATRACKER_EMLACUSTOMERS 
  WHERE btpOnbAdvEmail = 'eduardo.fagnudes@sap.com' AND trackApp IS NOT NULL
  UNION
  SELECT trackAppTP2 FROM EMSLATRACKER_EMLACUSTOMERS 
  WHERE btpOnbAdvEmail = 'eduardo.fagnudes@sap.com' AND trackAppTP2 IS NOT NULL
  UNION
  SELECT trackAppSH FROM EMSLATRACKER_EMLACUSTOMERS 
  WHERE btpOnbAdvEmail = 'eduardo.fagnudes@sap.com' AND trackAppSH IS NOT NULL
);

-- 3. Ver a estrutura da tabela ONBSESSION_DB_SESSIONS (comentado - descomente se necessário)
-- SELECT * FROM ONBSESSION_DB_SESSIONS LIMIT 1;

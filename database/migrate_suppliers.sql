-- Migration: Update suppliers table
-- Date: 2026-08-04
-- Changes:
--   1. Make currency_id NOT NULL (if not already)
--   2. Change credit_limit to allow NULL (remove DEFAULT 0)

-- Step 1: Set a default currency for suppliers that have no currency_id
-- (Set to the first currency in the company - adjust as needed)
UPDATE suppliers s
SET currency_id = (
  SELECT c.id FROM currencies c
  JOIN companies co ON co.id = s.company_id
  WHERE c.company_id = s.company_id
  LIMIT 1
)
WHERE s.currency_id IS NULL;

-- Step 2: Make currency_id NOT NULL
ALTER TABLE suppliers
  ALTER COLUMN currency_id SET NOT NULL;

-- Step 3: Allow credit_limit to be NULL (remove the NOT NULL constraint if present, and set DEFAULT NULL)
ALTER TABLE suppliers
  ALTER COLUMN credit_limit DROP DEFAULT,
  ALTER COLUMN credit_limit DROP NOT NULL;

-- Step 4: Change credit_limit 0 records to NULL if desired (optional - only if 0 meant "no limit")
-- Uncomment the line below only if you want existing 0 values to become NULL:
-- UPDATE suppliers SET credit_limit = NULL WHERE credit_limit = 0;

SELECT 'Migration completed successfully' AS status;

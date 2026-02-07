-- Add phone and is_internal fields to owners table
ALTER TABLE owners ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN owners.is_internal IS 'true = UP/BP Employee, false = Outside Partner';

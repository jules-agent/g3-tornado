-- ============================================
-- G3-Tornado Owner/Vendor Refactor Migration
-- Consolidates vendors into owners with employee/vendor flags
-- ============================================

-- ============================================
-- 1. ADD NEW COLUMNS TO OWNERS TABLE
-- ============================================

-- Add employee flags
ALTER TABLE owners ADD COLUMN IF NOT EXISTS is_up_employee BOOLEAN DEFAULT false;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS is_bp_employee BOOLEAN DEFAULT false;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS is_upfit_employee BOOLEAN DEFAULT false;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS is_third_party_vendor BOOLEAN DEFAULT false;

-- Add comments for clarity
COMMENT ON COLUMN owners.is_up_employee IS 'Employee of Unplugged Performance';
COMMENT ON COLUMN owners.is_bp_employee IS 'Employee of Bulletproof';
COMMENT ON COLUMN owners.is_upfit_employee IS 'Employee of UP.FIT';
COMMENT ON COLUMN owners.is_third_party_vendor IS 'External 3rd party vendor (mutually exclusive with employee flags)';

-- ============================================
-- 2. MIGRATE EXISTING VENDOR DATA TO OWNERS
-- ============================================

-- Insert vendors as owners with is_third_party_vendor = true
-- Skip if name already exists in owners
INSERT INTO owners (name, email, phone, is_third_party_vendor, created_by, created_by_email, created_at)
SELECT 
  v.name,
  v.email,
  v.phone,
  true,
  v.created_by,
  (SELECT email FROM profiles WHERE id = v.created_by),
  v.created_at
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM owners o WHERE LOWER(o.name) = LOWER(v.name)
)
ON CONFLICT (name) DO NOTHING;

-- Log the migration
INSERT INTO activity_log (action, entity_type, entity_id, entity_name, created_by_email, metadata, created_at)
SELECT 
  'migrated_from_vendor',
  'owner',
  o.id,
  o.name,
  'system@migration',
  jsonb_build_object('source', 'vendors_table', 'migration_date', NOW()::text),
  NOW()
FROM owners o
WHERE o.is_third_party_vendor = true
AND NOT EXISTS (
  SELECT 1 FROM activity_log al 
  WHERE al.entity_id = o.id 
  AND al.action = 'migrated_from_vendor'
);

-- ============================================
-- 3. REMOVE OBSOLETE is_internal COLUMN
-- ============================================

-- Convert existing is_internal data (if meaningful)
-- is_internal = true means employee (default to no specific company flag)
-- is_internal = false means partner (set as third party vendor)
UPDATE owners 
SET is_third_party_vendor = true 
WHERE is_internal = false 
AND is_third_party_vendor = false
AND is_up_employee = false
AND is_bp_employee = false
AND is_upfit_employee = false;

-- Drop the is_internal column
ALTER TABLE owners DROP COLUMN IF EXISTS is_internal;

-- ============================================
-- 4. ADD CONSTRAINT FOR MUTUAL EXCLUSIVITY
-- ============================================

-- Ensure that if is_third_party_vendor = true, all employee flags are false
-- (This is enforced at application level for flexibility, but we add a check)
CREATE OR REPLACE FUNCTION check_owner_flags()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_third_party_vendor = true THEN
    IF NEW.is_up_employee = true OR NEW.is_bp_employee = true OR NEW.is_upfit_employee = true THEN
      RAISE EXCEPTION 'Third party vendor cannot be an employee';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_owner_flags ON owners;
CREATE TRIGGER enforce_owner_flags
  BEFORE INSERT OR UPDATE ON owners
  FOR EACH ROW EXECUTE FUNCTION check_owner_flags();

-- ============================================
-- 5. DROP VENDORS TABLE AND RELATED OBJECTS
-- ============================================

-- Drop the trigger first
DROP TRIGGER IF EXISTS on_vendor_created ON vendors;

-- Drop the trigger function
DROP FUNCTION IF EXISTS log_vendor_created();

-- Drop RLS policies
DROP POLICY IF EXISTS "Vendors viewable by authenticated users" ON vendors;
DROP POLICY IF EXISTS "Users can add vendors" ON vendors;
DROP POLICY IF EXISTS "Admins can manage vendors" ON vendors;

-- Drop the vendors table
DROP TABLE IF EXISTS vendors;

-- ============================================
-- 6. CREATE INDEX FOR EFFICIENT FILTERING
-- ============================================

CREATE INDEX IF NOT EXISTS idx_owners_is_up_employee ON owners(is_up_employee) WHERE is_up_employee = true;
CREATE INDEX IF NOT EXISTS idx_owners_is_bp_employee ON owners(is_bp_employee) WHERE is_bp_employee = true;
CREATE INDEX IF NOT EXISTS idx_owners_is_upfit_employee ON owners(is_upfit_employee) WHERE is_upfit_employee = true;
CREATE INDEX IF NOT EXISTS idx_owners_is_third_party_vendor ON owners(is_third_party_vendor) WHERE is_third_party_vendor = true;

-- ============================================
-- 7. UPDATE ACTIVITY LOG ENTITY TYPES
-- ============================================

-- Update any existing 'vendor' entity_type to note migration
UPDATE activity_log 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb), 
  '{note}', 
  '"Vendor system deprecated - see owners table"'
)
WHERE entity_type = 'vendor';

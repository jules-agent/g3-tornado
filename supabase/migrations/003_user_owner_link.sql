-- Link users to owners (for "my tasks" functionality)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES owners(id) ON DELETE SET NULL;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_profiles_owner_id ON profiles(owner_id);

-- Comment for clarity
COMMENT ON COLUMN profiles.owner_id IS 'Links this user account to an owner record for "my tasks" filtering';

-- Add user status to profiles (active, paused, voided)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'voided'));
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

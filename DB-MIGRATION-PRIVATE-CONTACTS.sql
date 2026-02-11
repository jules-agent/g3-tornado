-- SQL Migration for Feature 3: Private Contacts
-- Run this in Supabase SQL Editor before testing the private contacts feature

-- Add is_private column (default false)
ALTER TABLE owners 
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- Add private_owner_id column (the user who owns this private contact)
ALTER TABLE owners 
ADD COLUMN IF NOT EXISTS private_owner_id UUID REFERENCES profiles(id);

-- Add index for faster private contact filtering
CREATE INDEX IF NOT EXISTS idx_owners_private_owner_id 
ON owners(private_owner_id) 
WHERE is_private = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN owners.is_private IS 'When true, this contact is private and only visible to the owner specified in private_owner_id';
COMMENT ON COLUMN owners.private_owner_id IS 'The profile ID of the user who owns this private contact. Only relevant when is_private is true';

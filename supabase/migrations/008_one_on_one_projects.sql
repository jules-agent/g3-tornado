-- Add one-on-one project support
ALTER TABLE projects ADD COLUMN IF NOT EXISTS one_on_one_owner_id UUID REFERENCES owners(id);
COMMENT ON COLUMN projects.one_on_one_owner_id IS 'For one-on-one projects: the owner shared with the creator';

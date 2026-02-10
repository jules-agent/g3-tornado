-- Project deadlines and critical path tracking
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS buffer_days INTEGER DEFAULT 7;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocker_category TEXT CHECK (blocker_category IN ('vendor', 'engineering', 'design', 'decision', 'other'));

COMMENT ON COLUMN projects.deadline IS 'Customer commitment date';
COMMENT ON COLUMN projects.buffer_days IS 'Days before deadline needed for QC/review/rework';
COMMENT ON COLUMN projects.customer_name IS 'Customer this project is for';
COMMENT ON COLUMN tasks.blocker_category IS 'Type of blocker: vendor, engineering, design, decision, other';

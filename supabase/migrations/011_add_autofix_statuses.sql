-- Add new auto-fix statuses to bug_reports status constraint
ALTER TABLE bug_reports DROP CONSTRAINT IF EXISTS bug_reports_status_check;

ALTER TABLE bug_reports 
  ADD CONSTRAINT bug_reports_status_check 
  CHECK (status IN (
    'pending', 
    'investigating', 
    'analyzing',
    'fixing', 
    'deployed',
    'fixed', 
    'escalated', 
    'duplicate', 
    'reviewing', 
    'approved', 
    'dismissed',
    'wont_fix',
    'rejected'
  ));

-- Add tagline_downvote type if not already present
ALTER TABLE bug_reports DROP CONSTRAINT IF EXISTS bug_reports_type_check;

ALTER TABLE bug_reports 
  ADD CONSTRAINT bug_reports_type_check 
  CHECK (type IN ('bug', 'feature_request', 'tagline_downvote'));

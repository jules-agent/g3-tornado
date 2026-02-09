-- ============================================
-- G3-Tornado User Management System Migration
-- ============================================

-- ============================================
-- 1. VENDORS TABLE (new entity type)
-- ============================================
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  company TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read vendors
CREATE POLICY "Vendors viewable by authenticated users" ON vendors FOR SELECT USING (auth.role() = 'authenticated');
-- All users can add vendors (distributed creation)
CREATE POLICY "Users can add vendors" ON vendors FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Admins can update/delete
CREATE POLICY "Admins can manage vendors" ON vendors FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 2. ACTIVITY LOG TABLE (audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL, -- 'created', 'deleted', 'updated', 'linked', 'unlinked'
  entity_type TEXT NOT NULL, -- 'owner', 'vendor', 'user', 'project', 'task'
  entity_id UUID NOT NULL,
  entity_name TEXT, -- Friendly name for display
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by_email TEXT, -- Denormalized for audit preservation
  metadata JSONB DEFAULT '{}', -- Additional context
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_by ON activity_log(created_by);

-- Enable RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- All authenticated can view activity log
CREATE POLICY "Activity log viewable by authenticated" ON activity_log FOR SELECT USING (auth.role() = 'authenticated');
-- Only system/authenticated can insert (via triggers or API)
CREATE POLICY "Activity log insertable by authenticated" ON activity_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Only admins can delete (for cleanup)
CREATE POLICY "Admins can delete activity log" ON activity_log FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 3. IMPERSONATION SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE, -- Random token for session
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ -- When admin exits impersonation
);

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_impersonation_token ON impersonation_sessions(token);
CREATE INDEX IF NOT EXISTS idx_impersonation_admin ON impersonation_sessions(admin_id);

-- Enable RLS
ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage impersonation sessions
CREATE POLICY "Admins can manage impersonation sessions" ON impersonation_sessions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 4. ADD created_by TO EXISTING TABLES
-- ============================================

-- Add created_by to owners table (if not exists)
ALTER TABLE owners ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS created_by_email TEXT;

-- Add created_by to projects table (if not exists)  
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by_email TEXT;

-- ============================================
-- 5. UPDATE RLS POLICIES FOR TASK FILTERING
-- ============================================

-- Drop existing task policies to replace them
DROP POLICY IF EXISTS "Tasks viewable by authenticated users" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can manage tasks" ON tasks;

-- Admins see all tasks
CREATE POLICY "Admins see all tasks" ON tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Users see only tasks they're assigned to (via task_owners) or via impersonation
CREATE POLICY "Users see their own tasks" ON tasks FOR SELECT USING (
  -- Check if user is linked to an owner assigned to this task
  EXISTS (
    SELECT 1 FROM task_owners to2
    JOIN profiles p ON p.owner_id = to2.owner_id
    WHERE to2.task_id = tasks.id
    AND p.id = auth.uid()
  )
  -- OR check if task description/notes mention the user's linked owner name
  OR EXISTS (
    SELECT 1 FROM profiles p
    JOIN owners o ON o.id = p.owner_id
    WHERE p.id = auth.uid()
    AND (
      tasks.description ILIKE '%' || o.name || '%'
      OR tasks.next_step ILIKE '%' || o.name || '%'
    )
  )
);

-- Users can update tasks they have access to (same logic as SELECT)
CREATE POLICY "Users can update their tasks" ON tasks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  OR EXISTS (
    SELECT 1 FROM task_owners to2
    JOIN profiles p ON p.owner_id = to2.owner_id
    WHERE to2.task_id = tasks.id
    AND p.id = auth.uid()
  )
);

-- Admins can insert/delete tasks
CREATE POLICY "Admins can insert tasks" ON tasks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can delete tasks" ON tasks FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 6. PENDING INVITES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pending_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  invite_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  link_to_owner_id UUID REFERENCES owners(id) ON DELETE SET NULL,
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_pending_invites_token ON pending_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_pending_invites_email ON pending_invites(email);

-- Enable RLS
ALTER TABLE pending_invites ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view and create invites
CREATE POLICY "Users can view invites" ON pending_invites FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can create invites" ON pending_invites FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage invites" ON pending_invites FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 7. UPDATE PROFILES TABLE
-- ============================================

-- Add invited_by column for tracking who invited each user
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- 8. ACTIVITY LOG TRIGGERS
-- ============================================

-- Trigger function to log owner creation
CREATE OR REPLACE FUNCTION log_owner_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_log (action, entity_type, entity_id, entity_name, created_by, created_by_email)
  SELECT 
    'created', 
    'owner', 
    NEW.id, 
    NEW.name, 
    NEW.created_by,
    p.email
  FROM profiles p WHERE p.id = NEW.created_by;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_owner_created
  AFTER INSERT ON owners
  FOR EACH ROW EXECUTE FUNCTION log_owner_created();

-- Trigger function to log vendor creation
CREATE OR REPLACE FUNCTION log_vendor_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_log (action, entity_type, entity_id, entity_name, created_by, created_by_email)
  SELECT 
    'created', 
    'vendor', 
    NEW.id, 
    NEW.name, 
    NEW.created_by,
    p.email
  FROM profiles p WHERE p.id = NEW.created_by;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_vendor_created
  AFTER INSERT ON vendors
  FOR EACH ROW EXECUTE FUNCTION log_vendor_created();

-- ============================================
-- 9. HELPER FUNCTIONS
-- ============================================

-- Function to check if current user is impersonating
CREATE OR REPLACE FUNCTION is_impersonating()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if there's an active impersonation session for current user
  RETURN EXISTS (
    SELECT 1 FROM impersonation_sessions
    WHERE admin_id = auth.uid()
    AND ended_at IS NULL
    AND expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get impersonated user (if any)
CREATE OR REPLACE FUNCTION get_impersonated_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT target_user_id FROM impersonation_sessions
    WHERE admin_id = auth.uid()
    AND ended_at IS NULL
    AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. VIEW FOR TASK LIST WITH USER FILTERING
-- ============================================

-- Drop existing view if exists
DROP VIEW IF EXISTS user_task_list;

-- Create view that respects user permissions
CREATE VIEW user_task_list AS
SELECT 
  t.*,
  p.name AS project_name,
  EXTRACT(DAY FROM NOW() - t.last_movement_at)::INTEGER AS days_since_movement,
  CASE 
    WHEN EXTRACT(DAY FROM NOW() - t.last_movement_at) > t.fu_cadence_days THEN 'red'
    ELSE 'green'
  END AS fu_status,
  (
    SELECT STRING_AGG(o.name, ', ')
    FROM task_owners to2
    JOIN owners o ON o.id = to2.owner_id
    WHERE to2.task_id = t.id
  ) AS owners_list,
  (
    SELECT ARRAY_AGG(to2.owner_id)
    FROM task_owners to2
    WHERE to2.task_id = t.id
  ) AS owner_ids
FROM tasks t
JOIN projects p ON p.id = t.project_id;

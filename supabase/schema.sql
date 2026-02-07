-- G3-Tornado Database Schema
-- Task management for UP.FIT projects

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS & AUTH
-- ============================================

-- User roles enum
CREATE TYPE user_role AS ENUM ('admin', 'user');

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'user',
  column_layout JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CORE TABLES
-- ============================================

-- Projects (e.g., "LVMPD 10", "Skydio Trailer")
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Owners (people who can be assigned to tasks)
CREATE TABLE owners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  is_internal BOOLEAN DEFAULT true, -- true = UP/BP Employee, false = Outside Partner
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task status enum
CREATE TYPE task_status AS ENUM ('open', 'in_progress', 'blocked', 'pending_close', 'closed');

-- Tasks (the main "Hit List" items)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Core fields
  task_number TEXT, -- Original task number from sheet
  description TEXT NOT NULL,
  status task_status NOT NULL DEFAULT 'open',
  
  -- FU(d) - Follow Up cadence
  fu_cadence_days INTEGER NOT NULL DEFAULT 7, -- How often to follow up
  last_movement_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Resets on note update OR blocker cleared
  
  -- Blocking
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  blocker_description TEXT,
  blocked_at TIMESTAMPTZ,
  
  -- Close request (for non-admin users)
  close_requested_at TIMESTAMPTZ,
  gates JSONB DEFAULT '[]',
  next_step TEXT,
  close_requested_by UUID REFERENCES profiles(id),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES profiles(id)
);

-- Task owners (many-to-many)
CREATE TABLE task_owners (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, owner_id)
);

-- ============================================
-- NOTES & CHANGE LOG
-- ============================================

-- Task notes (updates/comments)
CREATE TABLE task_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Change log (tracks all changes to tasks - columns C, F, G, H, I, J, K, L, M)
CREATE TABLE change_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- VIEWS
-- ============================================

-- Task list view with computed FU(d) status
CREATE VIEW task_list AS
SELECT 
  t.*,
  p.name AS project_name,
  -- Calculate days since last movement
  EXTRACT(DAY FROM NOW() - t.last_movement_at)::INTEGER AS days_since_movement,
  -- FU(d) status: green if within cadence, red if overdue
  CASE 
    WHEN EXTRACT(DAY FROM NOW() - t.last_movement_at) > t.fu_cadence_days THEN 'red'
    ELSE 'green'
  END AS fu_status,
  -- Aggregate owners
  (
    SELECT STRING_AGG(o.name, ', ')
    FROM task_owners to2
    JOIN owners o ON o.id = to2.owner_id
    WHERE to2.task_id = t.id
  ) AS owners_list
FROM tasks t
JOIN projects p ON p.id = t.project_id;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_log ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own
CREATE POLICY "Profiles are viewable by all users" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Projects: all authenticated users can read
CREATE POLICY "Projects viewable by authenticated users" ON projects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage projects" ON projects FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Owners: all authenticated users can read, admins manage
CREATE POLICY "Owners viewable by authenticated users" ON owners FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage owners" ON owners FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
-- Users can add new owners
CREATE POLICY "Users can add owners" ON owners FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Tasks: all authenticated can read, users can update, admins can do all
CREATE POLICY "Tasks viewable by authenticated users" ON tasks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update tasks" ON tasks FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage tasks" ON tasks FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Task owners: all authenticated can read and modify
CREATE POLICY "Task owners viewable by authenticated" ON task_owners FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Task owners modifiable by authenticated" ON task_owners FOR ALL USING (auth.role() = 'authenticated');

-- Notes: all authenticated can read and add
CREATE POLICY "Notes viewable by authenticated" ON task_notes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can add notes" ON task_notes FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Change log: all authenticated can read, system adds
CREATE POLICY "Change log viewable by authenticated" ON change_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Change log insertable by authenticated" ON change_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Reset last_movement_at when blocker is cleared
CREATE OR REPLACE FUNCTION reset_movement_on_blocker_clear()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_blocked = TRUE AND NEW.is_blocked = FALSE THEN
    NEW.last_movement_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_blocker_clear BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION reset_movement_on_blocker_clear();

-- Update last_movement_at when note is added
CREATE OR REPLACE FUNCTION update_task_movement_on_note()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tasks SET last_movement_at = NOW() WHERE id = NEW.task_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER note_updates_movement AFTER INSERT ON task_notes
  FOR EACH ROW EXECUTE FUNCTION update_task_movement_on_note();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- SEED DATA
-- ============================================

-- Insert default projects
INSERT INTO projects (name, description) VALUES
  ('LVMPD 10', 'Las Vegas Metropolitan Police Department - 10 vehicles'),
  ('Skydio Trailer', 'Skydio drone trailer project');

-- Insert some default owners (will be populated from sheet)
INSERT INTO owners (name) VALUES
  ('Ben'),
  ('Unassigned');

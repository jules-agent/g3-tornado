CREATE TABLE bug_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT NOT NULL,
  screenshot_url TEXT,
  reported_by UUID REFERENCES profiles(id),
  reported_by_email TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'fixed', 'escalated', 'duplicate')),
  resolution TEXT,
  fixed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create bug reports" ON bug_reports
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can view own bug reports" ON bug_reports
  FOR SELECT TO authenticated USING (reported_by = auth.uid());

CREATE POLICY "Admins can view all bug reports" ON bug_reports
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR email = 'ben@unpluggedperformance.com'))
  );

CREATE POLICY "Admins can update bug reports" ON bug_reports
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR email = 'ben@unpluggedperformance.com'))
  );

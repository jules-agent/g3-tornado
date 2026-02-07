// Backup script for G3-Tornado data
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backup() {
  const timestamp = new Date().toISOString();
  
  // Export all tables
  const [projects, tasks, taskNotes, profiles] = await Promise.all([
    supabase.from('projects').select('*'),
    supabase.from('tasks').select('*'),
    supabase.from('task_notes').select('*'),
    supabase.from('profiles').select('*')
  ]);
  
  const backup = {
    timestamp,
    projects: projects.data,
    tasks: tasks.data,
    task_notes: taskNotes.data,
    profiles: profiles.data
  };
  
  console.log(JSON.stringify(backup, null, 2));
}

backup().catch(console.error);

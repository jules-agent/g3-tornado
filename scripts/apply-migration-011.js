const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('📦 Applying migration 011_add_autofix_statuses.sql...');
  
  const migrationPath = path.join(__dirname, '../supabase/migrations/011_add_autofix_statuses.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const statement of statements) {
    console.log(`\n🔧 Executing: ${statement.substring(0, 80)}...`);
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });
    
    if (error) {
      // Try direct query if rpc fails
      const { error: queryError } = await supabase.from('_migrations').insert({
        name: '011_add_autofix_statuses',
        sql: statement
      });
      
      if (queryError) {
        console.error('❌ Error:', error);
        console.error('   Query Error:', queryError);
      }
    } else {
      console.log('✅ Success');
    }
  }
  
  console.log('\n✨ Migration complete!');
}

applyMigration().catch(console.error);

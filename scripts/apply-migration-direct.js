#!/usr/bin/env node
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Supabase connection details
const connectionString = 'postgresql://postgres.vrtplpchqeevbbpfopdq:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres';

async function applyMigration() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!');

    const migrationPath = path.join(__dirname, '../supabase/migrations/011_add_autofix_statuses.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📦 Applying migration 011_add_autofix_statuses.sql...\n');

    // Execute the full SQL
    await client.query(sql);
    
    console.log('✅ Migration applied successfully!');
    console.log('\n📋 New bug_reports statuses available:');
    console.log('   - pending, investigating, analyzing, fixing, deployed');
    console.log('   - fixed, escalated, duplicate, reviewing, approved');
    console.log('   - dismissed, wont_fix, rejected');

  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();

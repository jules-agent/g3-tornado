#!/usr/bin/env node
const { Client } = require('pg');
const fs = require('fs');

// Connection string from Supabase
// Format: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
const connectionString = 'postgresql://postgres.vrtplpchqeevbbpfopdq:Gigatron3000!!@aws-0-us-west-1.pooler.supabase.com:6543/postgres';

async function applyMigration() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!');

    const sql = `-- Add new auto-fix statuses to bug_reports status constraint
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
  CHECK (type IN ('bug', 'feature_request', 'tagline_downvote'));`;

    console.log('\n📦 Applying migration 011_add_autofix_statuses.sql...\n');

    await client.query(sql);
    
    console.log('✅ Migration applied successfully!');
    console.log('\n📋 Auto-fix engine can now use these statuses:');
    console.log('   - analyzing (AI analyzing bug)');
    console.log('   - fixing (AI implementing fix)');
    console.log('   - deployed (fix deployed to production)');
    console.log('\n🚀 Auto-fix engine ready to process 3 pending bugs!');

  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();

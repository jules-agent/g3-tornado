/**
 * Import Hit List data from CSV into G3-Tornado
 * 
 * Usage: 
 *   1. Export Google Sheet as CSV
 *   2. Place CSV file in scripts/hitlist.csv
 *   3. Run: npx ts-node scripts/import-hitlist.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Supabase config - using service role for direct insert
const SUPABASE_URL = 'https://vrtplpchqeevbbpfopdq.supabase.co';
// TODO: Add service role key here for import
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

interface HitListRow {
  id: string;
  topic: string;
  details: string;
  project: string;
  fuCadence: number | null;
  nextStep: string;
  owner: string;
  isClosed: boolean;
}

function parseCSV(csvContent: string): HitListRow[] {
  const lines = csvContent.split('\n');
  const rows: HitListRow[] = [];
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV parsing (doesn't handle quoted commas)
    const cols = line.split(',');
    if (cols.length < 7) continue;
    
    const fuValue = cols[4]?.trim();
    const isClosed = fuValue?.toLowerCase() === 'closed';
    const fuCadence = isClosed ? null : parseInt(fuValue) || 7;
    
    rows.push({
      id: cols[0]?.trim() || '',
      topic: cols[1]?.trim() || '',
      details: cols[2]?.trim() || '',
      project: cols[3]?.trim() || '',
      fuCadence,
      nextStep: cols[5]?.trim() || '',
      owner: cols[6]?.trim() || '',
      isClosed,
    });
  }
  
  return rows;
}

async function importData() {
  if (!SUPABASE_SERVICE_KEY) {
    console.error('Error: SUPABASE_SERVICE_KEY environment variable required');
    console.log('Get it from: https://supabase.com/dashboard/project/vrtplpchqeevbbpfopdq/settings/api-keys');
    process.exit(1);
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // Read CSV file
  const csvPath = path.join(__dirname, 'hitlist.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('Error: Place your CSV file at scripts/hitlist.csv');
    process.exit(1);
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(csvContent);
  
  console.log(`Parsed ${rows.length} rows from CSV`);
  
  // Get or create projects
  const projectNames = [...new Set(rows.map(r => r.project).filter(Boolean))];
  const projectMap: Record<string, string> = {};
  
  for (const name of projectNames) {
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('name', name)
      .maybeSingle();
    
    if (existing) {
      projectMap[name] = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from('projects')
        .insert({ name })
        .select('id')
        .single();
      
      if (error) {
        console.error(`Failed to create project ${name}:`, error);
        continue;
      }
      projectMap[name] = created.id;
      console.log(`Created project: ${name}`);
    }
  }
  
  // Get or create owners
  const ownerNames = [...new Set(rows.map(r => r.owner).filter(Boolean).filter(n => n !== '???'))];
  const ownerMap: Record<string, string> = {};
  
  for (const name of ownerNames) {
    const { data: existing } = await supabase
      .from('owners')
      .select('id')
      .eq('name', name)
      .maybeSingle();
    
    if (existing) {
      ownerMap[name] = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from('owners')
        .insert({ name })
        .select('id')
        .single();
      
      if (error) {
        console.error(`Failed to create owner ${name}:`, error);
        continue;
      }
      ownerMap[name] = created.id;
      console.log(`Created owner: ${name}`);
    }
  }
  
  // Import tasks
  let imported = 0;
  let skipped = 0;
  
  for (const row of rows) {
    if (!row.topic) {
      skipped++;
      continue;
    }
    
    const projectId = projectMap[row.project];
    if (!projectId) {
      console.warn(`Skipping task "${row.topic}" - no project`);
      skipped++;
      continue;
    }
    
    // Check if task already exists by task_number
    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('task_number', row.id)
      .maybeSingle();
    
    if (existing) {
      console.log(`Task ${row.id} already exists, skipping`);
      skipped++;
      continue;
    }
    
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        task_number: row.id,
        description: row.topic,
        project_id: projectId,
        fu_cadence_days: row.fuCadence || 7,
        status: row.isClosed ? 'closed' : 'open',
        is_blocked: row.details.toLowerCase().includes('blocker'),
        blocker_note: row.details.toLowerCase().includes('blocker') ? row.details : null,
      })
      .select('id')
      .single();
    
    if (error) {
      console.error(`Failed to create task ${row.id}:`, error);
      skipped++;
      continue;
    }
    
    // Add owner if exists
    const ownerId = ownerMap[row.owner];
    if (ownerId && task) {
      await supabase.from('task_owners').insert({
        task_id: task.id,
        owner_id: ownerId,
      });
    }
    
    // Add initial note with details
    if (row.details && task) {
      await supabase.from('task_notes').insert({
        task_id: task.id,
        content: `Imported from Hit List:\n${row.details}\n\nNext Step: ${row.nextStep}`,
      });
    }
    
    console.log(`✓ Imported: ${row.id} - ${row.topic.substring(0, 40)}...`);
    imported++;
  }
  
  console.log(`\nDone! Imported: ${imported}, Skipped: ${skipped}`);
}

importData().catch(console.error);

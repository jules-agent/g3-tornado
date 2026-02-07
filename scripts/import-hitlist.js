#!/usr/bin/env node
/**
 * Import Hit List CSV into G3-Tornado
 * Maps: Blocker A → Current Gate, Blocker B → Next Gate
 */

const https = require('https');
const fs = require('fs');

const SUPABASE_URL = 'https://vrtplpchqeevbbpfopdq.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydHBscGNocWVldmJicGZvcGRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNDM4OTgsImV4cCI6MjA4NTgxOTg5OH0.otRCGwWH0TZ47Auqr1xp26eO0ZNuN6kQ7vP2RDYDIaM';

const PROJECT_MAPPING = {
  'LVMPD': 'LVMPD Fleet Build',
  'Trailer': 'Trailer',
  'Model Y': 'Model Y',
  'Skydio CT': 'Skydio CT',
  'SpaceX': 'SpaceX',
  'Winch': 'Winch',
  'Ballistic Glass': 'Ballistic Glass'
};

function parseCSV(content) {
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f)) rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (currentField || currentRow.length) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f)) rows.push(currentRow);
  }
  
  const headers = rows[0].map(h => h.replace(/\n/g, ' ').trim());
  console.log('Headers:', headers.join(' | '));
  
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  }).filter(row => row.ID && row.ID.match(/^\d{4}$/) && row.Topic);
}

function parseChangelog(changelog) {
  if (!changelog) return [];
  const notePattern = /\[(\d{2}\/\d{2})\s+(\d{2}:\d{2})\]\s+([^\s]+)\s+-\s+(.+?)(?=\[\d{2}\/\d{2}|$)/gs;
  const notes = [];
  let match;
  
  while ((match = notePattern.exec(changelog)) !== null) {
    const [, date, time, email, content] = match;
    const [month, day] = date.split('/');
    const [hour, min] = time.split(':');
    const timestamp = new Date(2026, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(min));
    notes.push({ date: timestamp.toISOString(), email, content: content.trim() });
  }
  return notes.reverse();
}

function supabaseRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const headers = {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    };
    if (method === 'POST') headers['Prefer'] = 'return=representation';
    
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  console.log('📥 Importing Hit List CSV into G3-Tornado...\n');
  
  const csvContent = fs.readFileSync('/tmp/hitlist.csv', 'utf8');
  const rows = parseCSV(csvContent);
  console.log(`\nFound ${rows.length} valid tasks\n`);
  
  // Fetch projects
  const { data: projects } = await supabaseRequest('GET', '/rest/v1/projects?select=id,name');
  const projectMap = {};
  projects.forEach(p => projectMap[p.name] = p.id);
  console.log('Projects:', Object.keys(projectMap).join(', '), '\n');
  
  let created = 0, skipped = 0, noteCount = 0;
  const taskIds = {};
  
  for (const row of rows) {
    const taskNumber = row.ID;
    const topic = row.Topic;
    const csvProject = row.Project;
    const projectName = PROJECT_MAPPING[csvProject] || csvProject;
    const projectId = projectMap[projectName];
    
    if (!projectId) {
      console.log(`⚠️  ${taskNumber}: Unknown project "${csvProject}"`);
      skipped++;
      continue;
    }
    
    // Status
    const closedField = row['CLOSED All Cleared'] || '';
    const fuCadenceField = row['Follow Up Cadence (Days)'] || '';
    const isClosed = closedField === 'TRUE' || fuCadenceField === 'Closed';
    
    // FU cadence (use 0 for closed, default 7 for open)
    let fuCadence = parseInt(fuCadenceField) || 7;
    if (fuCadenceField === 'Closed' || isClosed) fuCadence = 0;
    
    // Description
    const details = row['Deliverable Details - Blocker Note Red If Blocked'] || '';
    const description = details ? `${topic}\n\n${details}` : topic;
    
    // Build gates array from Blocker A and Blocker B
    // Format: owner_name = person, task_name = what they need to do
    const gates = [];
    const blockerA = row['Who To Chase Blocker A'] || '';
    const blockerACleared = row['Blocker A Cleared'] === 'TRUE';
    const blockerB = row['Who To Chase Blocker B'] || '';
    const blockerBCleared = row['Blocker B Cleared'] === 'TRUE';
    const nextStep = row['Next Step Up Deliverable'] || '';
    const finalStep = row['Final Step Deliverable & Who'] || '';
    
    if (blockerA) {
      // Parse "Ben - Get Printer" format if present, otherwise just use name
      const parts = blockerA.includes(' - ') ? blockerA.split(' - ') : [blockerA, ''];
      gates.push({
        name: 'Gate 1',
        owner_name: parts[0].trim(),
        task_name: parts[1]?.trim() || nextStep || '',
        completed: blockerACleared
      });
    }
    if (blockerB) {
      const parts = blockerB.includes(' - ') ? blockerB.split(' - ') : [blockerB, ''];
      gates.push({
        name: 'Gate 2',
        owner_name: parts[0].trim(),
        task_name: parts[1]?.trim() || finalStep || '',
        completed: blockerBCleared
      });
    }
    
    // Parse last updated date
    let lastMovement = new Date().toISOString();
    const lastUpdated = row['Last Updated'];
    if (lastUpdated && lastUpdated.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [month, day, year] = lastUpdated.split('/');
      lastMovement = new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toISOString();
    }
    
    const taskData = {
      project_id: projectId,
      task_number: taskNumber,
      description: description,
      status: isClosed ? 'closed' : 'open',
      fu_cadence_days: fuCadence,
      next_step: row['Next Step Up Deliverable'] || null,
      gates: gates.length > 0 ? gates : [],
      is_blocked: gates.some(g => !g.completed),
      blocker_description: blockerA || null,
      last_movement_at: lastMovement,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { status, data } = await supabaseRequest('POST', '/rest/v1/tasks', taskData);
    
    if (status >= 200 && status < 300 && data && data[0]) {
      created++;
      taskIds[taskNumber] = data[0].id;
      console.log(`✅ ${taskNumber} - ${topic.substring(0, 45)}... [${gates.length} gates]`);
    } else {
      console.log(`❌ ${taskNumber}: ${JSON.stringify(data).substring(0, 100)}`);
      skipped++;
    }
    
    // Import notes
    const changelog = row['Update Change Log'] || '';
    const updateNotes = row['Update Notes'] || '';
    const taskId = taskIds[taskNumber];
    
    if (taskId && (changelog || updateNotes)) {
      const notes = parseChangelog(changelog);
      
      if (updateNotes && updateNotes !== 'blank') {
        notes.push({
          date: new Date().toISOString(),
          email: 'import',
          content: updateNotes
        });
      }
      
      for (const note of notes.slice(-5)) {
        const { status } = await supabaseRequest('POST', '/rest/v1/task_notes', {
          task_id: taskId,
          content: note.content,
          created_at: note.date,
          created_by: null
        });
        if (status >= 200 && status < 300) noteCount++;
      }
    }
  }
  
  console.log('\n📊 Import Complete:');
  console.log(`   ✅ Created: ${created} tasks`);
  console.log(`   ⚠️  Skipped: ${skipped} tasks`);
  console.log(`   📝 Notes: ${noteCount} imported`);
}

main().catch(console.error);

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// CSV data from Google Sheets - parsed at build time
// This endpoint wipes existing data and imports fresh from the sheet

export async function POST(request: Request) {
  const supabase = await createClient();

  // Check auth - must be admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== "ben@unpluggedperformance.com") {
    return NextResponse.json({ error: "Unauthorized - admin only" }, { status: 401 });
  }

  try {
    const { csvData, confirm } = await request.json();
    
    if (!confirm) {
      return NextResponse.json({ 
        error: "Must confirm=true to wipe and import",
        message: "This will DELETE all existing tasks and notes, then import from CSV"
      }, { status: 400 });
    }

    if (!csvData) {
      return NextResponse.json({ error: "csvData required" }, { status: 400 });
    }

    // Parse CSV
    const lines = csvData.split('\n');
    const tasks: Array<{
      task_number: string;
      description: string;
      next_step: string;
      project_name: string;
      fu_cadence_days: number;
      status: string;
      is_blocked: boolean;
      last_movement_at: string;
      latest_note: string;
      change_log: string;
    }> = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      // Parse CSV line (handle quoted fields with commas)
      const fields = parseCSVLine(line);
      if (fields.length < 13) continue;
      
      const [
        id, topic, deliverableDetails, project, cadence,
        nextStepUp, finalStep, blockerA, blockerB,
        blockerACleared, blockerBCleared, closedAllCleared,
        updateNotes, lastUpdated, changeLog
      ] = fields;

      // Skip empty rows
      if (!id || !topic) continue;

      // Parse cadence (might be "Closed" or a number)
      let fu_cadence_days = 7;
      if (cadence && cadence !== "Closed") {
        const parsed = parseInt(cadence, 10);
        if (!isNaN(parsed)) fu_cadence_days = parsed;
      }

      // Determine status
      const isClosed = closedAllCleared?.toUpperCase() === "TRUE" || cadence === "Closed";
      
      // Determine if blocked
      const is_blocked = (blockerACleared?.toUpperCase() === "FALSE" && blockerA) ||
                        (blockerBCleared?.toUpperCase() === "FALSE" && blockerB);

      // Parse last updated date
      let last_movement_at = new Date().toISOString();
      if (lastUpdated) {
        const parsed = new Date(lastUpdated);
        if (!isNaN(parsed.getTime())) {
          last_movement_at = parsed.toISOString();
        }
      }

      tasks.push({
        task_number: id.padStart(4, '0'),
        description: topic,
        next_step: deliverableDetails || nextStepUp || '',
        project_name: project || 'General',
        fu_cadence_days,
        status: isClosed ? 'closed' : 'open',
        is_blocked: !!is_blocked,
        last_movement_at,
        latest_note: updateNotes || '',
        change_log: changeLog || ''
      });
    }

    // Get unique projects
    const projectNames = [...new Set(tasks.map(t => t.project_name))];

    // Step 1: Delete existing data
    console.log("Deleting existing task_notes...");
    await supabase.from("task_notes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    
    console.log("Deleting existing task_owners...");
    await supabase.from("task_owners").delete().neq("task_id", "00000000-0000-0000-0000-000000000000");
    
    console.log("Deleting existing tasks...");
    await supabase.from("tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Step 2: Get or create projects
    const projectMap: Record<string, string> = {};
    for (const name of projectNames) {
      if (!name) continue;
      
      // Check if project exists
      const { data: existing } = await supabase
        .from("projects")
        .select("id")
        .eq("name", name)
        .maybeSingle();
      
      if (existing) {
        projectMap[name] = existing.id;
      } else {
        // Create project
        const { data: created, error } = await supabase
          .from("projects")
          .insert({ name })
          .select("id")
          .single();
        
        if (created) {
          projectMap[name] = created.id;
        }
      }
    }

    // Step 3: Insert tasks
    const insertedTasks: Array<{ id: string; task_number: string; latest_note: string; change_log: string }> = [];
    
    for (const task of tasks) {
      const project_id = projectMap[task.project_name];
      
      const { data: inserted, error } = await supabase
        .from("tasks")
        .insert({
          task_number: task.task_number,
          description: task.description,
          next_step: task.next_step,
          project_id,
          fu_cadence_days: task.fu_cadence_days,
          status: task.status,
          is_blocked: task.is_blocked,
          last_movement_at: task.last_movement_at,
        })
        .select("id, task_number")
        .single();
      
      if (inserted) {
        insertedTasks.push({
          ...inserted,
          latest_note: task.latest_note,
          change_log: task.change_log
        });
      } else if (error) {
        console.error("Failed to insert task:", task.task_number, error);
      }
    }

    // Step 4: Insert notes from change log
    let notesInserted = 0;
    for (const task of insertedTasks) {
      const notes = parseChangeLog(task.change_log);
      
      // If no parsed notes but we have a latest note, add it
      if (notes.length === 0 && task.latest_note) {
        notes.push({
          content: task.latest_note,
          created_at: new Date().toISOString(),
          author: 'ben@unpluggedperformance.com'
        });
      }

      for (const note of notes) {
        const { error } = await supabase
          .from("task_notes")
          .insert({
            task_id: task.id,
            content: note.content,
            created_at: note.created_at,
          });
        
        if (!error) notesInserted++;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        projects: Object.keys(projectMap).length,
        tasks: insertedTasks.length,
        notes: notesInserted
      }
    });

  } catch (error) {
    console.error("Import failed:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

function parseChangeLog(changeLog: string): Array<{ content: string; created_at: string; author: string }> {
  if (!changeLog) return [];
  
  const notes: Array<{ content: string; created_at: string; author: string }> = [];
  
  // Pattern: [MM/DD HH:MM] email - Update Notes: 'old' → 'new'
  const regex = /\[(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\]\s+([^\s]+)\s+-\s+Update Notes:\s+'[^']*'\s*→\s*'([^']*)'/g;
  
  let match;
  while ((match = regex.exec(changeLog)) !== null) {
    const [_, month, day, hour, minute, author, newContent] = match;
    
    // Assume 2026 for now
    const year = 2026;
    const date = new Date(year, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    
    if (newContent && newContent !== 'blank') {
      notes.push({
        content: newContent,
        created_at: date.toISOString(),
        author
      });
    }
  }
  
  return notes;
}

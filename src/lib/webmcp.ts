// WebMCP integration for G3 Tornado
// This exposes Tornado functionality as callable tools for AI agents

import { createClient } from '@/lib/supabase/client';

export function initializeWebMCP() {
  // Check if WebMCP is available
  if (typeof window === 'undefined' || !window.WebMCP) {
    console.warn('[G3 Tornado] WebMCP not available');
    return;
  }

  const mcp = new window.WebMCP({
    color: '#0066cc',
    position: 'bottom-right'
  });

  const supabase = createClient();

  // TOOL: Create Task
  mcp.registerTool(
    'createTask',
    'Creates a new task in G3 Tornado with the specified details',
    {
      title: { 
        type: 'string',
        description: 'Task title/description'
      },
      project_id: { 
        type: 'string', 
        description: 'UUID of the project this task belongs to',
        required: false 
      },
      owner_id: { 
        type: 'string',
        description: 'UUID of the person responsible for this task',
        required: false
      },
      fu_cadence_days: { 
        type: 'number',
        description: 'Follow-up cadence in days (default: 1)',
        required: false
      },
      gates: {
        type: 'array',
        description: 'Array of gate person names who must approve before task can close',
        required: false
      }
    },
    async (args: any) => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            title: args.title,
            project_id: args.project_id || null,
            owner_id: args.owner_id || null,
            fu_cadence_days: args.fu_cadence_days || 1,
            gates: args.gates || null,
            clock_started: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        return {
          success: true,
          task: data,
          message: `Created task: ${data.title}`
        };
      } catch (error: any) {
        throw new Error(`Failed to create task: ${error.message}`);
      }
    }
  );

  // TOOL: Get Tasks
  mcp.registerTool(
    'getTasks',
    'Retrieves tasks from G3 Tornado with optional filtering',
    {
      project_id: {
        type: 'string',
        description: 'Filter by project UUID',
        required: false
      },
      owner_id: {
        type: 'string',
        description: 'Filter by owner UUID',
        required: false
      },
      status: {
        type: 'string',
        description: 'Filter by status (open, stale, closed)',
        required: false
      },
      limit: {
        type: 'number',
        description: 'Maximum number of tasks to return (default: 50)',
        required: false
      }
    },
    async (args: any) => {
      try {
        let query = supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false });

        if (args.project_id) {
          query = query.eq('project_id', args.project_id);
        }

        if (args.owner_id) {
          query = query.eq('owner_id', args.owner_id);
        }

        if (args.status === 'closed') {
          query = query.not('completed_at', 'is', null);
        } else if (args.status === 'open' || args.status === 'stale') {
          query = query.is('completed_at', null);
        }

        query = query.limit(args.limit || 50);

        const { data, error } = await query;

        if (error) throw error;

        return {
          success: true,
          count: data.length,
          tasks: data
        };
      } catch (error: any) {
        throw new Error(`Failed to get tasks: ${error.message}`);
      }
    }
  );

  // TOOL: Update Task
  mcp.registerTool(
    'updateTask',
    'Updates an existing task with new information',
    {
      task_id: {
        type: 'string',
        description: 'UUID of the task to update'
      },
      title: {
        type: 'string',
        description: 'New title',
        required: false
      },
      owner_id: {
        type: 'string',
        description: 'New owner UUID',
        required: false
      },
      project_id: {
        type: 'string',
        description: 'New project UUID',
        required: false
      },
      fu_cadence_days: {
        type: 'number',
        description: 'New follow-up cadence in days',
        required: false
      }
    },
    async (args: any) => {
      try {
        const updates: any = {};
        if (args.title) updates.title = args.title;
        if (args.owner_id) updates.owner_id = args.owner_id;
        if (args.project_id) updates.project_id = args.project_id;
        if (args.fu_cadence_days) updates.fu_cadence_days = args.fu_cadence_days;

        const { data, error } = await supabase
          .from('tasks')
          .update(updates)
          .eq('id', args.task_id)
          .select()
          .single();

        if (error) throw error;

        return {
          success: true,
          task: data,
          message: `Updated task: ${data.title}`
        };
      } catch (error: any) {
        throw new Error(`Failed to update task: ${error.message}`);
      }
    }
  );

  // TOOL: Complete Task
  mcp.registerTool(
    'completeTask',
    'Marks a task as completed',
    {
      task_id: {
        type: 'string',
        description: 'UUID of the task to complete'
      }
    },
    async (args: any) => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .update({ 
            completed_at: new Date().toISOString(),
            followup_date: null
          })
          .eq('id', args.task_id)
          .select()
          .single();

        if (error) throw error;

        return {
          success: true,
          task: data,
          message: `Completed task: ${data.title}`
        };
      } catch (error: any) {
        throw new Error(`Failed to complete task: ${error.message}`);
      }
    }
  );

  // TOOL: Add Note
  mcp.registerTool(
    'addNote',
    'Adds a note/comment to a task',
    {
      task_id: {
        type: 'string',
        description: 'UUID of the task'
      },
      note: {
        type: 'string',
        description: 'Note text'
      }
    },
    async (args: any) => {
      try {
        const { data: task, error: fetchError } = await supabase
          .from('tasks')
          .select('notes')
          .eq('id', args.task_id)
          .single();

        if (fetchError) throw fetchError;

        const existingNotes = task.notes || '';
        const timestamp = new Date().toISOString();
        const newNote = `[${timestamp}] ${args.note}`;
        const updatedNotes = existingNotes 
          ? `${existingNotes}\n\n${newNote}`
          : newNote;

        const { data, error } = await supabase
          .from('tasks')
          .update({ notes: updatedNotes })
          .eq('id', args.task_id)
          .select()
          .single();

        if (error) throw error;

        return {
          success: true,
          task: data,
          message: `Added note to task: ${data.title}`
        };
      } catch (error: any) {
        throw new Error(`Failed to add note: ${error.message}`);
      }
    }
  );

  // TOOL: Add Gate
  mcp.registerTool(
    'addGate',
    'Adds a gate (approval checkpoint) to a task',
    {
      task_id: {
        type: 'string',
        description: 'UUID of the task'
      },
      gate_person: {
        type: 'string',
        description: 'Name of the person who must approve'
      }
    },
    async (args: any) => {
      try {
        const { data: task, error: fetchError } = await supabase
          .from('tasks')
          .select('gates')
          .eq('id', args.task_id)
          .single();

        if (fetchError) throw fetchError;

        const existingGates = task.gates || [];
        const newGate = {
          id: crypto.randomUUID(),
          person: args.gate_person,
          cleared: false,
          added_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('tasks')
          .update({ gates: [...existingGates, newGate] })
          .eq('id', args.task_id)
          .select()
          .single();

        if (error) throw error;

        return {
          success: true,
          task: data,
          message: `Added gate: ${args.gate_person}`
        };
      } catch (error: any) {
        throw new Error(`Failed to add gate: ${error.message}`);
      }
    }
  );

  // TOOL: Clear Gate
  mcp.registerTool(
    'clearGate',
    'Clears (approves) a gate on a task',
    {
      task_id: {
        type: 'string',
        description: 'UUID of the task'
      },
      gate_id: {
        type: 'string',
        description: 'UUID of the gate to clear'
      }
    },
    async (args: any) => {
      try {
        const { data: task, error: fetchError } = await supabase
          .from('tasks')
          .select('gates')
          .eq('id', args.task_id)
          .single();

        if (fetchError) throw fetchError;

        const gates = (task.gates || []).map((g: any) => 
          g.id === args.gate_id 
            ? { ...g, cleared: true, cleared_at: new Date().toISOString() }
            : g
        );

        const { data, error } = await supabase
          .from('tasks')
          .update({ gates })
          .eq('id', args.task_id)
          .select()
          .single();

        if (error) throw error;

        return {
          success: true,
          task: data,
          message: 'Gate cleared'
        };
      } catch (error: any) {
        throw new Error(`Failed to clear gate: ${error.message}`);
      }
    }
  );

  // TOOL: Search Tasks
  mcp.registerTool(
    'searchTasks',
    'Searches tasks by keyword in title or notes',
    {
      query: {
        type: 'string',
        description: 'Search query'
      },
      limit: {
        type: 'number',
        description: 'Maximum results (default: 20)',
        required: false
      }
    },
    async (args: any) => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .or(`title.ilike.%${args.query}%,notes.ilike.%${args.query}%`)
          .order('created_at', { ascending: false })
          .limit(args.limit || 20);

        if (error) throw error;

        return {
          success: true,
          count: data.length,
          tasks: data
        };
      } catch (error: any) {
        throw new Error(`Failed to search tasks: ${error.message}`);
      }
    }
  );

  // RESOURCE: Current User
  mcp.registerResource(
    'current-user',
    'Information about the currently logged-in user',
    {
      uri: 'tornado://user/current',
      mimeType: 'application/json'
    },
    async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return {
        contents: [{
          uri: 'tornado://user/current',
          mimeType: 'application/json',
          text: JSON.stringify(user, null, 2)
        }]
      };
    }
  );

  // RESOURCE: Projects List
  mcp.registerResource(
    'projects-list',
    'List of all projects in the system',
    {
      uri: 'tornado://projects',
      mimeType: 'application/json'
    },
    async () => {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .order('name');

      return {
        contents: [{
          uri: 'tornado://projects',
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
  );

  console.log('[G3 Tornado] WebMCP initialized with', mcp.tools.size, 'tools');

  return mcp;
}

// Type declaration for window.WebMCP
declare global {
  interface Window {
    WebMCP: any;
    tornadoMCP: any;
  }
}

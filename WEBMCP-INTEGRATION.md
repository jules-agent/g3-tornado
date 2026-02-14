# WebMCP Integration for G3 Tornado

**Status:** ✅ **IMPLEMENTED** (Feb 13, 2026 - 10:30 PM PST)

## What is WebMCP?

WebMCP (Web Model Context Protocol) is a new W3C web standard that allows websites to expose structured "tools" (JavaScript functions) that AI agents can call directly, instead of using browser automation (clicking, typing, etc.).

**Think of it as:** Your website publishing an API that AI agents can discover and use automatically.

## What We Implemented

G3 Tornado now exposes **8 tools** that AI agents (including Jules) can use to interact with the app directly:

### Tools Available:

1. **createTask** - Create a new task with title, project, owner, cadence, gates
2. **getTasks** - Retrieve tasks with optional filtering (project, owner, status, limit)
3. **updateTask** - Update existing task fields (title, owner, project, cadence)
4. **completeTask** - Mark a task as completed
5. **addNote** - Add a timestamped note/comment to a task
6. **addGate** - Add a gate (approval checkpoint) to a task
7. **clearGate** - Clear (approve) a gate on a task
8. **searchTasks** - Search tasks by keyword in title or notes

### Resources Available:

1. **current-user** - Info about the logged-in user
2. **projects-list** - List of all projects in the system

## How It Works

### For Users:
When you're logged into G3 Tornado, you'll see a small blue 🤖 icon in the bottom-right corner. This indicates WebMCP is active. Click it to see which tools are registered.

### For AI Agents:
Instead of:
```javascript
// Old way (browser automation)
browser.snapshot() → find "Create Task" button → click → type fields → submit
```

Now agents can do:
```javascript
// New way (WebMCP)
navigator.modelContext.callTool('createTask', {
  title: 'Follow up with customer',
  project_id: '123-456-789',
  fu_cadence_days: 3
})
```

## Files Added/Modified

**New files:**
- `/public/webmcp.js` - WebMCP library (client-side)
- `/src/lib/webmcp.ts` - G3 Tornado tool definitions
- `/src/components/WebMCPProvider.tsx` - React wrapper component
- `WEBMCP-INTEGRATION.md` - This file

**Modified files:**
- `/src/app/(protected)/layout.tsx` - Wrapped in WebMCPProvider

## Benefits

1. **Faster** - Direct function calls instead of UI manipulation
2. **More Reliable** - Works even if UI layout changes
3. **Better DX** - AI agents get structured schemas for each tool
4. **Future-Proof** - W3C standard supported by Chrome, Edge, etc.

## Testing

### Manual Test (Browser Console):
```javascript
// Check if WebMCP is loaded
console.log(navigator.modelContext);

// List available tools
navigator.modelContext.listTools();

// Create a test task
await navigator.modelContext.callTool('createTask', {
  title: 'Test task from WebMCP',
  fu_cadence_days: 1
});

// Search tasks
await navigator.modelContext.callTool('searchTasks', {
  query: 'test',
  limit: 5
});
```

### AI Agent Test:
When Jules (or another AI agent) has browser control on G3 Tornado, they can now call these tools directly instead of clicking through the UI.

## Browser Support

- ✅ Chrome 146 Canary and later
- ✅ Edge (Chromium) with flag enabled
- ⏳ Other browsers (pending W3C standardization)

For older browsers, the app continues to work normally - WebMCP is a progressive enhancement.

## Future Enhancements

Potential additions:
- **Focus Mode tools** - `getFocusTasks()`, `groupByGate()`
- **Project tools** - `createProject()`, `updateProject()`
- **Contact tools** - `getContacts()`, `createContact()`
- **Admin tools** - `getUsers()`, `impersonate()`, `getKPIs()`
- **Parking Lot tools** - `addToParkingLot()`, `spawnTaskFromParking()`

## Resources

- WebMCP Spec: https://webmachinelearning.github.io/webmcp
- Demo: https://webmcp.dev
- GitHub: https://github.com/webmachinelearning/webmcp
- Chrome Blog: https://developer.chrome.com/blog/webmcp-epp

## Notes

- Tools run with the permissions of the logged-in user
- All database operations go through Supabase RLS (Row Level Security)
- Tools are only available after user authentication
- The 🤖 indicator can be customized via `WebMCP` constructor options

---

**Implementation Time:** ~20 minutes  
**Build Status:** Ready to deploy  
**Next Step:** Push to production and test with Jules's browser control

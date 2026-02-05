import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  
  // Fetch projects
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  // Fetch tasks with their projects
  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      *,
      projects (name)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🌪️ G3-Tornado</h1>
              <p className="text-sm text-gray-500">UP.FIT Task Management</p>
            </div>
            <div className="flex gap-4">
              <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                + New Task
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Tasks</div>
            <div className="text-3xl font-bold text-gray-900">{tasks?.length || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Open</div>
            <div className="text-3xl font-bold text-green-600">
              {tasks?.filter(t => t.status === 'open').length || 0}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Blocked</div>
            <div className="text-3xl font-bold text-red-600">
              {tasks?.filter(t => t.is_blocked).length || 0}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Projects</div>
            <div className="text-3xl font-bold text-gray-900">{projects?.length || 0}</div>
          </div>
        </div>

        {/* Projects */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Projects</h2>
          <div className="flex gap-2 flex-wrap">
            {projects?.map(project => (
              <span 
                key={project.id}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
              >
                {project.name}
              </span>
            ))}
            {(!projects || projects.length === 0) && (
              <span className="text-gray-500 text-sm">No projects yet</span>
            )}
          </div>
        </div>

        {/* Task List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Hit List</h2>
          </div>
          
          {tasks && tasks.length > 0 ? (
            <div className="divide-y">
              {tasks.map(task => {
                const daysSinceMovement = Math.floor(
                  (Date.now() - new Date(task.last_movement_at).getTime()) / (1000 * 60 * 60 * 24)
                )
                const isOverdue = daysSinceMovement > task.fu_cadence_days
                
                return (
                  <div key={task.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {task.is_blocked && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded">
                              BLOCKED
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            task.status === 'open' ? 'bg-green-100 text-green-800' :
                            task.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {task.status.toUpperCase()}
                          </span>
                          {task.task_number && (
                            <span className="text-gray-400 text-sm">#{task.task_number}</span>
                          )}
                        </div>
                        <p className="mt-1 text-gray-900 font-medium">{task.description}</p>
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                          <span>{task.projects?.name || 'No project'}</span>
                          <span>FU({task.fu_cadence_days}d)</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                          {daysSinceMovement}d
                        </div>
                        <div className="text-xs text-gray-400">since movement</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <div className="text-gray-400 text-4xl mb-4">📋</div>
              <p className="text-gray-500">No tasks yet. Create your first task to get started!</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProjectFilter } from "@/components/ProjectFilter";

type Task = {
  id: string;
  description: string;
  status: string;
  is_blocked: boolean;
  fu_cadence_days: number;
  last_movement_at: string;
  task_number: string | null;
  project_id: string;
  projects: { id: string; name: string } | null;
  task_owners: { owner_id: string; owners: { id: string; name: string } | null }[] | null;
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; project?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = user?.email === "ben@unpluggedperformance.com";

  const [{ data: projects }, { data: allTasks }] = await Promise.all([
    supabase.from("projects").select("id, name").order("name"),
    supabase
      .from("tasks")
      .select(
        `
        id,
        description,
        status,
        is_blocked,
        fu_cadence_days,
        last_movement_at,
        task_number,
        project_id,
        projects (id, name),
        task_owners (owner_id, owners (id, name))
      `
      )
      .order("task_number", { ascending: true }),
  ]);

  // Calculate days and overdue status for each task
  const tasksWithDays = (allTasks as Task[] | null)?.map((task) => {
    const daysSinceMovement = Math.floor(
      (Date.now() - new Date(task.last_movement_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const isOverdue = task.status === "open" && daysSinceMovement > task.fu_cadence_days;
    const owners =
      task.task_owners
        ?.map((to) => to.owners?.name)
        .filter(Boolean)
        .join(", ") || "";
    return { ...task, daysSinceMovement, isOverdue, ownerNames: owners };
  }) ?? [];

  // Filter tasks
  const filter = params.filter || "open";
  const projectFilter = params.project || "all";
  
  let filteredTasks = tasksWithDays;
  
  if (filter === "open") {
    filteredTasks = filteredTasks.filter((t) => t.status === "open");
  } else if (filter === "closed") {
    filteredTasks = filteredTasks.filter((t) => t.status === "closed");
  } else if (filter === "blocked") {
    filteredTasks = filteredTasks.filter((t) => t.is_blocked);
  } else if (filter === "overdue") {
    filteredTasks = filteredTasks.filter((t) => t.isOverdue);
  }
  
  if (projectFilter !== "all") {
    filteredTasks = filteredTasks.filter((t) => t.project_id === projectFilter);
  }

  // Sort - default by overdue first, then by days descending
  const sort = params.sort || "priority";
  if (sort === "priority") {
    filteredTasks.sort((a, b) => {
      // Overdue first
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      // Then blocked
      if (a.is_blocked && !b.is_blocked) return -1;
      if (!a.is_blocked && b.is_blocked) return 1;
      // Then by days descending
      return b.daysSinceMovement - a.daysSinceMovement;
    });
  } else if (sort === "id") {
    filteredTasks.sort((a, b) => (a.task_number ?? "").localeCompare(b.task_number ?? ""));
  } else if (sort === "days") {
    filteredTasks.sort((a, b) => b.daysSinceMovement - a.daysSinceMovement);
  } else if (sort === "project") {
    filteredTasks.sort((a, b) => (a.projects?.name ?? "").localeCompare(b.projects?.name ?? ""));
  }

  // Stats
  const stats = {
    total: allTasks?.length ?? 0,
    open: tasksWithDays.filter((t) => t.status === "open").length,
    closed: tasksWithDays.filter((t) => t.status === "closed").length,
    blocked: tasksWithDays.filter((t) => t.is_blocked).length,
    overdue: tasksWithDays.filter((t) => t.isOverdue).length,
  };

  const filters = [
    { key: "all", label: "All", count: stats.total },
    { key: "open", label: "Open", count: stats.open },
    { key: "overdue", label: "Overdue", count: stats.overdue, color: "text-red-600" },
    { key: "blocked", label: "Blocked", count: stats.blocked, color: "text-amber-600" },
    { key: "closed", label: "Closed", count: stats.closed },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hit List</h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-slate-600">{stats.open} open</span>
              </span>
              <span className="flex items-center gap-1.5 text-sm">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-slate-600">{stats.overdue} overdue</span>
              </span>
              <span className="flex items-center gap-1.5 text-sm">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-slate-600">{stats.blocked} blocked</span>
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Admin
              </Link>
            )}
            <Link
              href="/tasks/new"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/30 hover:-translate-y-0.5 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Task
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
          {filters.map((f) => (
            <Link
              key={f.key}
              href={`/?filter=${f.key}${projectFilter !== "all" ? `&project=${projectFilter}` : ""}`}
              className={`px-4 py-2 text-sm font-medium border-r border-slate-200 last:border-r-0 transition ${
                filter === f.key
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className={f.color && filter !== f.key ? f.color : undefined}>{f.label}</span>
              <span className={`ml-1.5 ${filter === f.key ? "text-slate-400" : "text-slate-400"}`}>{f.count}</span>
            </Link>
          ))}
        </div>
        <ProjectFilter 
          projects={projects ?? []} 
          currentFilter={filter} 
          currentProject={projectFilter} 
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header text-left text-xs text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-3 font-semibold w-16">ID</th>
              <th className="px-4 py-3 font-semibold">Task</th>
              <th className="px-4 py-3 font-semibold w-32">Project</th>
              <th className="px-4 py-3 font-semibold w-32">Owner</th>
              <th className="px-4 py-3 font-semibold w-20 text-center">Cadence</th>
              <th className="px-4 py-3 font-semibold w-16 text-center">Days</th>
              <th className="px-4 py-3 font-semibold w-24 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => {
                let rowClasses = "table-row";
                if (task.status === "closed") {
                  rowClasses += " bg-slate-50/50 text-slate-400";
                } else if (task.isOverdue) {
                  rowClasses += " bg-gradient-to-r from-red-50 to-transparent border-l-4 border-l-red-500";
                } else if (task.is_blocked) {
                  rowClasses += " bg-gradient-to-r from-amber-50 to-transparent border-l-4 border-l-amber-500";
                }

                return (
                  <tr key={task.id} className={rowClasses}>
                    <td className="px-4 py-3">
                      <Link href={`/tasks/${task.id}`} className="text-slate-400 hover:text-cyan-600 font-mono text-xs">
                        {task.task_number || "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/tasks/${task.id}`} className="group">
                        <span className={`group-hover:text-cyan-600 transition ${task.status === "closed" ? "text-slate-400" : "text-slate-800 font-medium"}`}>
                          {task.description}
                        </span>
                      </Link>
                      {task.isOverdue && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white">
                          OVERDUE
                        </span>
                      )}
                      {task.is_blocked && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                          BLOCKED
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 truncate max-w-32">
                      {task.projects?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 truncate max-w-32">
                      {task.ownerNames || "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-400 text-xs">
                      {task.fu_cadence_days}d
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold text-lg ${
                        task.status === "closed" 
                          ? "text-slate-300" 
                          : task.isOverdue 
                            ? "text-red-600" 
                            : task.daysSinceMovement > task.fu_cadence_days * 0.75
                              ? "text-amber-500"
                              : "text-emerald-500"
                      }`}>
                        {task.daysSinceMovement}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {task.status === "closed" ? (
                        <span className="status-closed inline-flex px-2 py-1 rounded-full text-[10px] font-semibold">CLOSED</span>
                      ) : task.status === "close_requested" ? (
                        <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">PENDING</span>
                      ) : (
                        <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">OPEN</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>No tasks match your filters</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer stats */}
      <div className="text-xs text-slate-400 text-right">
        Showing {filteredTasks.length} of {stats.total} tasks
      </div>
    </div>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProjectFilter } from "@/components/ProjectFilter";
import { SearchBox } from "@/components/SearchBox";

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
  searchParams: Promise<{ filter?: string; project?: string; sort?: string; q?: string }>;
}) {
  const params = await searchParams;
  const searchQuery = params.q || "";
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

  // Search filter - comma-separated terms work as AND
  if (searchQuery) {
    const searchTerms = searchQuery.split(',').map(term => term.trim().toLowerCase()).filter(Boolean);
    filteredTasks = filteredTasks.filter((task) => {
      const searchableText = [
        task.description,
        task.task_number,
        task.projects?.name,
        task.ownerNames,
        task.status
      ].filter(Boolean).join(' ').toLowerCase();
      
      // All terms must match (AND logic)
      return searchTerms.every(term => searchableText.includes(term));
    });
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
    <div className="space-y-3">
      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox />
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm text-sm">
          {filters.map((f) => (
            <Link
              key={f.key}
              href={`/?filter=${f.key}${projectFilter !== "all" ? `&project=${projectFilter}` : ""}`}
              className={`px-4 py-2 text-sm font-medium border-r border-slate-200 dark:border-slate-700 last:border-r-0 transition ${
                filter === f.key
                  ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <span className={f.color && filter !== f.key ? f.color : undefined}>{f.label}</span>
              <span className={`ml-1.5 ${filter === f.key ? "text-white/60" : "text-slate-400 dark:text-slate-500"}`}>{f.count}</span>
            </Link>
          ))}
        </div>
        <ProjectFilter 
          projects={projects ?? []} 
          currentFilter={filter} 
          currentProject={projectFilter} 
        />
        {isAdmin && (
          <Link
            href="/admin"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            ⚙️ Admin
          </Link>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header text-left text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="px-3 py-2 font-semibold w-14">ID</th>
              <th className="px-3 py-2 font-semibold">Task</th>
              <th className="px-3 py-2 font-semibold w-28">Project</th>
              <th className="px-3 py-2 font-semibold w-28">Owner</th>
              <th className="px-3 py-2 font-semibold w-16 text-center">Cad.</th>
              <th className="px-3 py-2 font-semibold w-12 text-center">Days</th>
              <th className="px-3 py-2 font-semibold w-20 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => {
                let rowClasses = "table-row";
                if (task.status === "closed") {
                  rowClasses += " bg-slate-50/50 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500";
                } else if (task.isOverdue) {
                  rowClasses += " bg-gradient-to-r from-red-50 to-white dark:from-red-900/30 dark:to-slate-800 border-l-4 border-l-red-500";
                } else if (task.is_blocked) {
                  rowClasses += " bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/30 dark:to-slate-800 border-l-4 border-l-amber-500";
                } else {
                  rowClasses += " bg-white dark:bg-slate-800/40";
                }

                return (
                  <tr key={task.id} className={rowClasses}>
                    <td className="px-3 py-2">
                      <Link href={`/tasks/${task.id}`} className="text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 font-mono text-xs font-medium">
                        {task.task_number || "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/tasks/${task.id}`} className="group">
                        <span className={`group-hover:text-cyan-500 transition text-sm ${task.status === "closed" ? "text-slate-400 dark:text-slate-400" : "text-slate-900 dark:text-white font-medium"}`}>
                          {task.description}
                        </span>
                      </Link>
                      {task.isOverdue && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white">
                          OVERDUE
                        </span>
                      )}
                      {task.is_blocked && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                          BLOCKED
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200 truncate max-w-28 text-sm">
                      {task.projects?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200 truncate max-w-28 text-sm">
                      {task.ownerNames || "—"}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-500 dark:text-slate-400 text-xs">
                      {task.fu_cadence_days}d
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`font-bold text-lg ${
                        task.status === "closed" 
                          ? "text-slate-400 dark:text-slate-500" 
                          : task.isOverdue 
                            ? "text-red-600 dark:text-red-400" 
                            : task.daysSinceMovement > task.fu_cadence_days * 0.75
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {task.daysSinceMovement}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {task.status === "closed" ? (
                        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">CLOSED</span>
                      ) : task.status === "close_requested" ? (
                        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">PENDING</span>
                      ) : (
                        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">OPEN</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-12 h-12 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      <div className="text-[11px] text-slate-400 dark:text-slate-500 text-right -mt-1">
        {filteredTasks.length} of {stats.total}
      </div>
    </div>
  );
}

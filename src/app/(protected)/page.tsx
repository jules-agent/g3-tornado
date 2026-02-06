import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProjectFilter } from "@/components/ProjectFilter";
import { SearchBox } from "@/components/SearchBox";
import { TaskTable } from "@/components/TaskTable";

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

      {/* Table with resizable/reorderable columns */}
      <TaskTable tasks={filteredTasks} total={stats.total} />
    </div>
  );
}

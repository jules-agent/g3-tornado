import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProjectFilter } from "@/components/ProjectFilter";
import { SearchBox } from "@/components/SearchBox";
import { TaskTable } from "@/components/TaskTable";

type Gate = {
  name: string;
  owner_name: string;
  task_name?: string;
  completed: boolean;
};

type TaskNote = {
  id: string;
  content: string;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
};

type Task = {
  id: string;
  description: string;
  status: string;
  is_blocked: boolean;
  fu_cadence_days: number;
  last_movement_at: string;
  created_at: string;
  task_number: string | null;
  project_id: string;
  gates: Gate[] | null;
  next_step: string | null;
  projects: { id: string; name: string } | null;
  task_owners: { owner_id: string; owners: { id: string; name: string } | null }[] | null;
  task_notes: TaskNote[] | null;
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
        created_at,
        task_number,
        project_id,
        gates,
        next_step,
        projects (id, name),
        task_owners (owner_id, owners (id, name)),
        task_notes (id, content, created_at, profiles (full_name, email))
      `
      )
      .order("task_number", { ascending: true }),
  ]);

  // Calculate days and stale status for each task
  const tasksWithDays = (allTasks as Task[] | null)?.map((task) => {
    const daysSinceMovement = Math.floor(
      (Date.now() - new Date(task.last_movement_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const daysSinceCreated = Math.floor(
      (Date.now() - new Date(task.created_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    // Stale = needs attention because cadence period has passed
    const isStale = task.status === "open" && daysSinceMovement > task.fu_cadence_days;
    const owners =
      task.task_owners
        ?.map((to) => to.owners?.name)
        .filter(Boolean)
        .join(", ") || "";
    // Sort notes by date descending
    const notes = task.task_notes?.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ) || [];
    return { ...task, daysSinceMovement, daysSinceCreated, isStale, ownerNames: owners, notes };
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
  } else if (filter === "stale") {
    filteredTasks = filteredTasks.filter((t) => t.isStale);
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

  // Sort - default by stale first, then by days descending
  const sort = params.sort || "priority";
  if (sort === "priority") {
    filteredTasks.sort((a, b) => {
      // Stale first (needs attention)
      if (a.isStale && !b.isStale) return -1;
      if (!a.isStale && b.isStale) return 1;
      // Then gated
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
    gated: tasksWithDays.filter((t) => t.is_blocked).length,
    stale: tasksWithDays.filter((t) => t.isStale).length,
  };

  const filters = [
    { key: "all", label: "All", count: stats.total },
    { key: "open", label: "Open", count: stats.open },
    { key: "stale", label: "Stale", count: stats.stale, color: "text-amber-600" },
    { key: "blocked", label: "Gated", count: stats.gated, color: "text-slate-600" },
    { key: "closed", label: "Done", count: stats.closed },
  ];

  return (
    <div className="space-y-1">
      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-1.5">
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

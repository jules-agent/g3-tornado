import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveUser } from "@/lib/impersonation";
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
  estimated_hours: number | null;
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

  const effectiveUser = await getEffectiveUser();
  if (!effectiveUser) return null;

  const isAdmin = effectiveUser.role === "admin" || effectiveUser.email === "ben@unpluggedperformance.com";
  // When impersonating, use the target user's role — NOT admin
  const viewAsAdmin = effectiveUser.isImpersonating ? false : isAdmin;

  const userOwnerId = effectiveUser.ownerId ?? null;

  // Get owner flags for project filtering
  let userOwnerFlags: { is_up_employee?: boolean; is_bp_employee?: boolean; is_upfit_employee?: boolean; is_third_party_vendor?: boolean } | null = null;
  if (userOwnerId) {
    const { data: ownerData } = await supabase
      .from("owners")
      .select("is_up_employee, is_bp_employee, is_upfit_employee, is_third_party_vendor")
      .eq("id", userOwnerId)
      .maybeSingle();
    userOwnerFlags = ownerData;
  }

  const [{ data: projects }, { data: allTasks }, { data: allProfiles }] = await Promise.all([
    supabase.from("projects").select("id, name, is_up, is_bp, is_upfit, visibility, created_by, one_on_one_owner_id").order("name"),
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
        estimated_hours,
        projects (id, name),
        task_owners (owner_id, owners (id, name)),
        task_notes (id, content, created_at, profiles (full_name, email))
      `
      )
      .order("task_number", { ascending: true }),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  // Build creator name lookup
  const creatorNames: Record<string, string> = {};
  (allProfiles || []).forEach((p: { id: string; full_name: string | null; email: string }) => {
    creatorNames[p.id] = p.full_name || p.email || "Unknown";
  });

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
    // Get owner IDs for "my tasks" check
    const ownerIds = task.task_owners?.map((to) => to.owner_id).filter(Boolean) || [];
    const isMyTask = userOwnerId ? ownerIds.includes(userOwnerId) : false;
    // Sort notes by date descending
    const notes = task.task_notes?.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ) || [];
    return { ...task, daysSinceMovement, daysSinceCreated, isStale, ownerNames: owners, ownerIds, isMyTask, notes };
  }) ?? [];

  // Get voided user owner_ids to hide their tasks
  let voidedOwnerIds: Set<string> = new Set();
  {
    const { data: voidedProfiles } = await supabase
      .from("profiles")
      .select("owner_id")
      .eq("status", "voided");
    voidedOwnerIds = new Set(
      (voidedProfiles || []).map((p) => p.owner_id).filter(Boolean) as string[]
    );
  }

  // Filter projects by visibility and team membership
  type ProjectWithFlags = { id: string; name: string; is_up?: boolean; is_bp?: boolean; is_upfit?: boolean; visibility?: string; created_by?: string };
  const allProjects = (projects as ProjectWithFlags[] ?? []);
  // Build set of project IDs created by this user (for personal/one-on-one visibility)
  const myProjectIds = new Set(
    allProjects.filter((p: ProjectWithFlags) => p.created_by === effectiveUser.effectiveUserId).map(p => p.id)
  );

  // Everyone sees only their own tasks + tasks in projects they created
  // Admin status gives management powers, not expanded visibility
  const visibleTasks = tasksWithDays.filter((t) => {
        // Show if user is an owner on the task
        if (t.isMyTask) {
          // But hide if ALL owners are voided
          if (voidedOwnerIds.size > 0 && t.ownerIds.length > 0) {
            const allVoided = t.ownerIds.every((id: string) => voidedOwnerIds.has(id));
            if (allVoided) return false;
          }
          return true;
        }
        // Also show tasks in projects the user created (personal, one-on-one)
        if (t.project_id && myProjectIds.has(t.project_id)) return true;
        return false;
      });
  const visibleProjects = allProjects.filter((p: ProjectWithFlags & { one_on_one_owner_id?: string }) => {
    // Personal projects: only visible to creator
    if (p.visibility === "personal") {
      return p.created_by === effectiveUser.effectiveUserId;
    }
    // One-on-one: visible to creator and the shared owner
    if (p.visibility === "one_on_one") {
      return p.created_by === effectiveUser.effectiveUserId || (userOwnerId && p.one_on_one_owner_id === userOwnerId);
    }
    // Shared projects: admins see all, others filter by team
    if (isAdmin) return true;
    if (!p.is_up && !p.is_bp && !p.is_upfit) return true;
    if (p.is_up && userOwnerFlags?.is_up_employee) return true;
    if (p.is_bp && userOwnerFlags?.is_bp_employee) return true;
    if (p.is_upfit && userOwnerFlags?.is_upfit_employee) return true;
    if (userOwnerFlags?.is_third_party_vendor) return true;
    return false;
  });

  // One-on-one project IDs for "Shared" tab
  const oneOnOneProjectIds = new Set(
    visibleProjects.filter((p: ProjectWithFlags & { one_on_one_owner_id?: string }) => p.visibility === "one_on_one").map(p => p.id)
  );

  // Filter tasks
  const filter = params.filter || "open";
  const projectFilter = params.project || "all";
  
  let filteredTasks = visibleTasks;
  
  if (filter === "open") {
    filteredTasks = filteredTasks.filter((t) => t.status === "open");
  } else if (filter === "closed") {
    filteredTasks = filteredTasks.filter((t) => t.status === "closed");
  } else if (filter === "blocked") {
    filteredTasks = filteredTasks.filter((t) => t.is_blocked);
  } else if (filter === "overdue") {
    filteredTasks = filteredTasks.filter((t) => t.isStale);
  } else if (filter === "shared") {
    filteredTasks = filteredTasks.filter((t) => t.project_id && oneOnOneProjectIds.has(t.project_id));
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

  // Sort - priority order:
  // 1. My stale tasks (pulsing red) - top
  // 2. Other stale tasks
  // 3. Open tasks (not stale, not done)
  // 4. Done tasks - always at bottom
  const sort = params.sort || "priority";
  if (sort === "priority") {
    filteredTasks.sort((a, b) => {
      // Done tasks always at bottom
      const aDone = a.status === "closed";
      const bDone = b.status === "closed";
      if (aDone && !bDone) return 1;
      if (!aDone && bDone) return -1;
      
      // My stale tasks at the very top
      const aMyStale = a.isStale && a.isMyTask;
      const bMyStale = b.isStale && b.isMyTask;
      if (aMyStale && !bMyStale) return -1;
      if (!aMyStale && bMyStale) return 1;
      
      // Other stale tasks next
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
  } else if (sort === "blocker") {
    // Group by current gate owner (blocker person)
    filteredTasks.sort((a, b) => {
      const aGate = (a.gates || []).find((g: Gate) => !g.completed);
      const bGate = (b.gates || []).find((g: Gate) => !g.completed);
      const aBlocker = aGate?.owner_name || "zzz_none";
      const bBlocker = bGate?.owner_name || "zzz_none";
      if (aBlocker !== bBlocker) return aBlocker.localeCompare(bBlocker);
      return b.daysSinceMovement - a.daysSinceMovement;
    });
  }

  // Stats (based on visible tasks for the user)
  const stats = {
    total: visibleTasks.length,
    open: visibleTasks.filter((t) => t.status === "open").length,
    closed: visibleTasks.filter((t) => t.status === "closed").length,
    gated: visibleTasks.filter((t) => t.is_blocked).length,
    overdue: visibleTasks.filter((t) => t.isStale).length,
  };

  // Count shared (one-on-one) tasks
  const sharedCount = visibleTasks.filter(t => t.project_id && oneOnOneProjectIds.has(t.project_id)).length;

  const filters = [
    { key: "all", label: "All", count: stats.total },
    { key: "open", label: "Open", count: stats.open },
    { key: "overdue", label: "Overdue", count: stats.overdue, color: "text-amber-600" },
    { key: "blocked", label: "Gated", count: stats.gated, color: "text-slate-600" },
    { key: "closed", label: "Done", count: stats.closed },
    ...(sharedCount > 0 ? [{ key: "shared", label: "Shared", count: sharedCount }] : []),
  ];

  return (
    <div className="space-y-1">
      {/* Search and Filters - sticky */}
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 pb-1 space-y-1.5">
        {/* Desktop: Search on its own row */}
        <div className="hidden sm:block">
          <SearchBox />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-x-auto shadow-sm text-sm scrollbar-hide flex-shrink min-w-0">
            {filters.map((f) => (
              <Link
                key={f.key}
                href={`/?filter=${f.key}${projectFilter !== "all" ? `&project=${projectFilter}` : ""}`}
                className={`px-2.5 sm:px-4 py-2 sm:py-2 text-xs sm:text-sm font-semibold border-r border-slate-200 dark:border-slate-700 last:border-r-0 transition whitespace-nowrap min-h-[44px] flex items-center ${
                  filter === f.key
                    ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                <span className={f.color && filter !== f.key ? f.color : undefined}>{f.label}</span>
                <span className={`ml-1 ${filter === f.key ? "text-white/70" : "text-slate-400 dark:text-slate-500"}`}>{f.count}</span>
              </Link>
            ))}
          </div>
          <ProjectFilter 
            projects={visibleProjects} 
            currentFilter={filter} 
            currentProject={projectFilter}
            creatorNames={creatorNames}
          />
          {/* Mobile: Search icon inline with filters */}
          <div className="sm:hidden">
            <SearchBox />
          </div>
          {viewAsAdmin && (
            <Link
              href="/admin"
              className="hidden sm:inline-flex px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition whitespace-nowrap flex-shrink-0"
            >
              ⚙️ Admin
            </Link>
          )}
        </div>
      </div>

      {/* Table with resizable/reorderable columns */}
      <TaskTable tasks={filteredTasks} total={stats.total} allTasks={visibleTasks} currentProject={projectFilter} currentFilter={filter} creatorNames={creatorNames} projectCreators={Object.fromEntries(allProjects.map(p => [p.id, p.created_by || ""]))} />
    </div>
  );
}

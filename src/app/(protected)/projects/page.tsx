import { createClient } from "@/lib/supabase/server";
import { getEffectiveUser } from "@/lib/impersonation";
import { redirect } from "next/navigation";
import { ProjectEditor } from "@/components/ProjectEditor";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const effectiveUser = await getEffectiveUser();
  if (!effectiveUser) redirect("/login");

  const isAdmin = effectiveUser.role === "admin" || effectiveUser.email === "ben@unpluggedperformance.com";

  const [{ data: projects }, { data: tasks }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, description, is_up, is_bp, is_upfit, visibility, created_by, one_on_one_owner_id, created_at")
      .order("name"),
    supabase
      .from("tasks")
      .select("id, status, project_id, fu_cadence_days, last_movement_at")
  ]);

  // Build project stats
  const projectStats: Record<string, { total: number; open: number; closed: number; overdue: number }> = {};
  for (const t of (tasks || []) as { id: string; status: string; project_id: string; fu_cadence_days: number; last_movement_at: string }[]) {
    if (!t.project_id) continue;
    if (!projectStats[t.project_id]) projectStats[t.project_id] = { total: 0, open: 0, closed: 0, overdue: 0 };
    const s = projectStats[t.project_id];
    s.total++;
    if (t.status === "open") {
      s.open++;
      const days = Math.floor((Date.now() - new Date(t.last_movement_at).getTime()) / 86400000);
      if (days > t.fu_cadence_days) s.overdue++;
    } else if (t.status === "closed") {
      s.closed++;
    }
  }

  // Get all profiles for creator names
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email");

  const creatorNames: Record<string, string> = {};
  (profiles || []).forEach((p) => {
    creatorNames[p.id] = p.full_name || p.email || "Unknown";
  });

  // Users see: projects they created + shared projects they have access to
  const visibleProjects = isAdmin
    ? (projects || [])
    : (projects || []).filter((p) => p.created_by === effectiveUser.effectiveUserId);

  return (
    <div className="max-w-3xl mx-auto py-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">My Projects</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        Edit your project details. {isAdmin ? "As admin, you can edit all projects." : "You can edit projects you created."}
      </p>
      {/* Project Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 mb-6">
        {visibleProjects.map((p) => {
          const stats = projectStats[p.id] || { total: 0, open: 0, closed: 0, overdue: 0 };
          const pct = stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0;
          return (
            <div key={p.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{p.name}</h3>
                <span className="text-xs text-slate-400">{stats.total} tasks</span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mb-2">
                <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-teal-600 dark:text-teal-400 font-semibold">{pct}% done</span>
                <span className="text-slate-500">{stats.open} open</span>
                {stats.overdue > 0 && <span className="text-red-500 font-semibold">{stats.overdue} overdue</span>}
                <span className="text-emerald-500">{stats.closed} done</span>
              </div>
            </div>
          );
        })}
      </div>

      <ProjectEditor
        projects={visibleProjects}
        creatorNames={creatorNames}
        currentUserId={effectiveUser.effectiveUserId}
        isAdmin={isAdmin}
      />
    </div>
  );
}

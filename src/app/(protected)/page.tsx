import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const [{ data: projects }, { data: tasks }] = await Promise.all([
    supabase.from("projects").select("id, name").order("created_at", {
      ascending: false,
    }),
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
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const totalTasks = tasks?.length ?? 0;
  const openTasks = tasks?.filter((task) => task.status === "open").length ?? 0;
  const blockedTasks = tasks?.filter((task) => task.is_blocked).length ?? 0;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Today&apos;s Hit List
            </h1>
            <p className="text-sm text-slate-500">
              Follow-ups, blockers, and next moves across active projects.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/tasks/new"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              + New Task
            </Link>
            <div className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">
              {projects?.length ?? 0} projects active
            </div>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Total Tasks
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">
              {totalTasks}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Open
            </div>
            <div className="mt-2 text-2xl font-semibold text-emerald-600">
              {openTasks}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Blocked
            </div>
            <div className="mt-2 text-2xl font-semibold text-rose-600">
              {blockedTasks}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Projects
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">
              {projects?.length ?? 0}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Hit List</h2>
          <span className="text-sm text-slate-400">Last 50 tasks</span>
        </div>
        {tasks && tasks.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {tasks.map((task) => {
              const daysSinceMovement = Math.floor(
                (Date.now() - new Date(task.last_movement_at).getTime()) /
                  (1000 * 60 * 60 * 24)
              );
              const isOverdue = daysSinceMovement > task.fu_cadence_days;
              const owners =
                task.task_owners
                  ?.map((owner) => owner.owners?.name)
                  .filter(Boolean)
                  .join(", ") || "Unassigned";

              return (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="group flex flex-col gap-4 px-6 py-5 transition hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {task.is_blocked && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">
                          Blocked
                        </span>
                      )}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                        {task.status.replace("_", " ")}
                      </span>
                      {task.task_number && (
                        <span className="text-slate-400">#{task.task_number}</span>
                      )}
                    </div>
                    <div className="text-base font-semibold text-slate-900 group-hover:text-slate-950">
                      {task.description}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span>{task.projects?.name ?? "No project"}</span>
                      <span>•</span>
                      <span>FU {task.fu_cadence_days}d</span>
                      <span>•</span>
                      <span>{owners}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-semibold ${
                        isOverdue ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {daysSinceMovement}d
                    </div>
                    <div className="text-xs text-slate-400">since movement</div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-slate-500">
            <div className="text-4xl">📋</div>
            <p className="mt-3">No tasks yet. Create your first task to get started!</p>
          </div>
        )}
      </section>
    </div>
  );
}

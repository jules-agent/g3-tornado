import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TaskForm from "@/components/TaskForm";
import AddNoteForm from "@/components/AddNoteForm";
import TaskActions from "@/components/TaskActions";

export default async function TaskDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: task }, { data: notes }, { data: owners }, { data: projects }] =
    await Promise.all([
      user
        ? supabase
            .from("profiles")
            .select("id, role")
            .eq("id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("tasks")
        .select(
          `
          id,
          description,
          status,
          is_blocked,
          blocker_description,
          fu_cadence_days,
          last_movement_at,
          task_number,
          project_id,
          close_requested_at,
          projects (id, name),
          task_owners (owner_id, owners (id, name))
        `
        )
        .eq("id", params.id)
        .single(),
      supabase
        .from("task_notes")
        .select("id, content, created_at, created_by, profiles (full_name, email)")
        .eq("task_id", params.id)
        .order("created_at", { ascending: false }),
      supabase.from("owners").select("id, name").order("name"),
      supabase.from("projects").select("id, name").order("name"),
    ]);

  if (!task) {
    notFound();
  }

  const taskOwners = task.task_owners as unknown as
    | { owner_id: string; owners: { name: string } | null }[]
    | null;
  const ownerNames =
    taskOwners
      ?.map((to) => to.owners?.name)
      .filter(Boolean)
      .join(", ") || "Unassigned";
  const selectedOwnerIds =
    taskOwners?.map((to) => to.owner_id).filter(Boolean) ?? [];

  const daysSinceMovement = Math.floor(
    (Date.now() - new Date(task.last_movement_at).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const isOverdue = daysSinceMovement > task.fu_cadence_days;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Task detail
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {task.description}
          </h1>
        </div>
        <Link
          href="/"
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          Back to list
        </Link>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {task.is_blocked && (
                <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">
                  Blocked
                </span>
              )}
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                {task.status.replace("_", " ")}
              </span>
              {task.task_number && (
                <span className="text-slate-400">#{task.task_number}</span>
              )}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Project
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {(task.projects as unknown as { name: string } | null)?.name ?? "No project"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Owners
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {ownerNames}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Cadence
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {task.fu_cadence_days} days
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Movement
                </div>
                <div
                  className={`mt-1 text-sm font-semibold ${
                    isOverdue ? "text-rose-600" : "text-emerald-600"
                  }`}
                >
                  {daysSinceMovement} days since update
                </div>
              </div>
            </div>
            {task.blocker_description && task.is_blocked && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {task.blocker_description}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Notes</h2>
              <span className="text-xs uppercase tracking-wide text-slate-400">
                {notes?.length ?? 0} updates
              </span>
            </div>
            <div className="mt-4">
              <AddNoteForm taskId={task.id} />
            </div>
            <div className="mt-6 space-y-4">
              {notes && notes.length > 0 ? (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="text-sm text-slate-700">{note.content}</div>
                    <div className="mt-2 text-xs text-slate-400">
                      {(() => {
                        const profile = note.profiles as unknown as { full_name: string | null; email: string } | null;
                        return profile?.full_name || profile?.email || "Unknown";
                      })()}
                      {" • "}
                      {new Date(note.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                  No notes yet. Add the first update to reset movement.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Task actions</h2>
            <p className="mt-1 text-sm text-slate-500">
              Admins can close tasks. Users can request close when ready.
            </p>
            <div className="mt-4">
              <TaskActions
                taskId={task.id}
                status={task.status}
                isAdmin={profile?.role === "admin"}
                closeRequestedAt={task.close_requested_at}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Edit task</h2>
            <p className="mt-1 text-sm text-slate-500">
              Update owners, cadence, or blockers.
            </p>
            <div className="mt-4">
              <TaskForm
                mode="edit"
                taskId={task.id}
                projects={projects ?? []}
                owners={owners ?? []}
                selectedOwnerIds={selectedOwnerIds}
                initialValues={{
                  description: task.description,
                  project_id: task.project_id,
                  fu_cadence_days: task.fu_cadence_days,
                  status: task.status,
                  task_number: task.task_number,
                  is_blocked: task.is_blocked,
                  blocker_description: task.blocker_description,
                }}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

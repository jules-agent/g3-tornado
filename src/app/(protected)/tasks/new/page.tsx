import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TaskForm from "@/components/TaskForm";

export default async function NewTaskPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: allProjects }, { data: owners }] = await Promise.all([
    supabase.from("projects").select("id, name, is_up, is_bp, is_upfit, visibility, created_by, one_on_one_owner_id").order("name"),
    supabase.from("owners").select("id, name, is_up_employee, is_bp_employee, is_upfit_employee, is_third_party_vendor").order("name"),
  ]);

  // Get user's owner_id for one-on-one filtering
  const { data: userProfile } = await supabase.from("profiles").select("owner_id").eq("id", user?.id ?? "").maybeSingle();

  // Filter: show personal projects only to creator, one-on-one to creator + shared owner
  const projects = (allProjects ?? []).filter(p => {
    if (p.visibility === "personal") return p.created_by === user?.id;
    if (p.visibility === "one_on_one") {
      return p.created_by === user?.id || (userProfile?.owner_id && p.one_on_one_owner_id === userProfile.owner_id);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📋</span>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent dark:from-cyan-400 dark:to-teal-400">
                Create New Task
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">Define the task, assign owners, and set follow-up cadence</p>
            </div>
          </div>
        </div>
        <Link
          href="/"
          className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 transition hover:border-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          ← Back to list
        </Link>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <TaskForm
          mode="create"
          projects={projects ?? []}
          owners={owners ?? []}
          initialValues={{
            description: "",
            project_id: "",
            fu_cadence_days: 3,
          }}
        />
      </div>
    </div>
  );
}

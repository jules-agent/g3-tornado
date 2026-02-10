import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TaskForm from "@/components/TaskForm";

export default async function NewTaskPage() {
  const supabase = await createClient();

  const [{ data: projects }, { data: owners }] = await Promise.all([
    supabase.from("projects").select("id, name, is_up, is_bp, is_upfit").order("name"),
    supabase.from("owners").select("id, name, is_up_employee, is_bp_employee, is_upfit_employee, is_third_party_vendor").order("name"),
  ]);

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
            project_id: projects?.[0]?.id ?? "",
            fu_cadence_days: 7,
          }}
        />
      </div>
    </div>
  );
}

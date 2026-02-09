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
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            New task
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Create a new task
          </h1>
        </div>
        <Link
          href="/"
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          Back to list
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

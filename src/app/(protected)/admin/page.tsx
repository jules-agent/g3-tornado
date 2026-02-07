import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminTabs } from "@/components/admin/AdminTabs";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = user?.email === "ben@unpluggedperformance.com";

  if (!isAdmin) {
    redirect("/");
  }

  const activeTab = params.tab || "users";

  // Fetch all data
  const [
    { data: profiles },
    { data: projects },
    { data: owners },
    { data: tasks },
  ] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role, owner_id, created_at").order("created_at", { ascending: false }),
    supabase.from("projects").select("*").order("name"),
    supabase.from("owners").select("*").order("name"),
    supabase.from("tasks").select("id, status"),
  ]);

  const stats = {
    users: profiles?.length || 0,
    projects: projects?.length || 0,
    owners: owners?.length || 0,
    tasks: tasks?.length || 0,
    openTasks: tasks?.filter((t) => t.status === "open").length || 0,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Admin Panel</h1>
          <p className="text-xs text-slate-500">
            {stats.users} users · {stats.projects} projects · {stats.owners} owners · {stats.tasks} tasks
          </p>
        </div>
        <Link
          href="/"
          className="text-xs text-slate-500 hover:text-slate-900"
        >
          ← Dashboard
        </Link>
      </div>

      {/* Tabs */}
      <AdminTabs 
        activeTab={activeTab}
        profiles={profiles || []}
        projects={projects || []}
        owners={owners || []}
      />
    </div>
  );
}

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

  if (!user) {
    redirect("/login");
  }

  // Check if user is admin by role in profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || user.email === "ben@unpluggedperformance.com";

  if (!isAdmin) {
    redirect("/");
  }

  const activeTab = params.tab || "users";

  // Fetch all data (vendors removed - now part of owners)
  const [
    { data: profiles },
    { data: projects },
    { data: owners },
    { data: activityLogs },
    { data: tasks },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, role, owner_id, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("*").order("name"),
    supabase.from("owners").select(`
      id, 
      name, 
      email, 
      phone, 
      is_up_employee,
      is_bp_employee,
      is_upfit_employee,
      is_third_party_vendor,
      created_by_email, 
      created_at
    `).order("name"),
    supabase
      .from("activity_log")
      .select(`
        id,
        action,
        entity_type,
        entity_id,
        entity_name,
        created_by,
        created_by_email,
        created_at,
        creator:profiles!activity_log_created_by_fkey(id, email, full_name)
      `)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("tasks").select("id, status"),
  ]);

  // Count employees vs vendors in owners
  const employeeCount = owners?.filter(o => 
    o.is_up_employee || o.is_bp_employee || o.is_upfit_employee
  ).length || 0;
  const vendorCount = owners?.filter(o => o.is_third_party_vendor).length || 0;

  const stats = {
    users: profiles?.length || 0,
    projects: projects?.length || 0,
    owners: owners?.length || 0,
    employees: employeeCount,
    vendors: vendorCount,
    tasks: tasks?.length || 0,
    openTasks: tasks?.filter((t) => t.status === "open").length || 0,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Admin Panel</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {stats.users} users · {stats.projects} projects · {stats.owners} owners ({stats.employees} employees, {stats.vendors} vendors) · {stats.tasks} tasks
          </p>
        </div>
        <Link
          href="/"
          className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
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
        activityLogs={activityLogs || []}
      />
    </div>
  );
}

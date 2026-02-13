import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
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
    { data: pendingInvites },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, role, owner_id, status, created_at")
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
      is_bpas_employee,
      is_third_party_vendor,
      is_personal,
      is_private,
      private_owner_id,
      created_by,
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
    supabase.from("pending_invites")
      .select("id, email, role, invite_token, expires_at, accepted_at, created_at")
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  // Fetch all auth users via service role to catch any missing from profiles
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: authUsersResponse } = await serviceClient.auth.admin.listUsers();
  const authUsers = authUsersResponse?.users || [];
  
  // Merge: ensure every auth user appears in the profiles list
  const profileIds = new Set((profiles || []).map(p => p.id));
  const mergedProfiles = [...(profiles || [])];
  for (const au of authUsers) {
    if (!profileIds.has(au.id)) {
      // User exists in auth but not profiles — create profile row and add to list
      await serviceClient.from("profiles").upsert({
        id: au.id,
        email: au.email,
        full_name: au.user_metadata?.full_name || au.email,
        role: "user",
      });
      mergedProfiles.push({
        id: au.id,
        email: au.email || "",
        full_name: au.user_metadata?.full_name || au.email || "",
        role: "user",
        owner_id: null,
        status: "active",
        created_at: au.created_at,
      });
    }
  }

  // Filter out pending invites where user already signed up (email exists in profiles)
  const activeEmails = new Set(mergedProfiles.map(p => p.email?.toLowerCase()));
  const filteredPendingInvites = (pendingInvites || []).filter(
    inv => !activeEmails.has(inv.email?.toLowerCase())
  );

  const stats = {
    users: mergedProfiles.length,
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
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Admin Panel</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {stats.users} users · {stats.projects} projects · {stats.owners} owners · {stats.tasks} tasks
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
        profiles={mergedProfiles}
        projects={projects || []}
        owners={owners || []}
        activityLogs={activityLogs || []}
        pendingInvites={filteredPendingInvites}
        creatorNames={Object.fromEntries((profiles || []).map((p: { id: string; full_name: string | null; email: string }) => [p.id, p.full_name || p.email || "Unknown"]))}
      />
    </div>
  );
}

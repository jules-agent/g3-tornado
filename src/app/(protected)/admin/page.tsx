import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Admin check - hardcoded for now, will be from profiles table later
  const isAdmin = user?.email === "ben@unpluggedperformance.com";

  if (!isAdmin) {
    redirect("/");
  }

  // Get all users from auth (profiles table)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: false });

  // Get recent activity from change_log
  const { data: recentActivity } = await supabase
    .from("change_log")
    .select(`
      id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      created_at,
      created_by,
      profiles (full_name, email)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  // Get task stats
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, status, created_at");

  const totalTasks = tasks?.length || 0;
  const openTasks = tasks?.filter((t) => t.status === "open").length || 0;
  const closedTasks = tasks?.filter((t) => t.status === "closed").length || 0;

  const typedActivity = recentActivity as unknown as Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    created_at: string;
    created_by: string | null;
    profiles: { full_name: string | null; email: string } | null;
  }>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="mb-4 inline-flex items-center text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Admin Panel
          </h1>
          <p className="mt-2 text-slate-600">
            Manage users, view activity, and control permissions
          </p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-3xl font-bold text-slate-900">{profiles?.length || 0}</div>
            <div className="text-sm text-slate-600">Total Users</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-3xl font-bold text-slate-900">{totalTasks}</div>
            <div className="text-sm text-slate-600">Total Tasks</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-3xl font-bold text-emerald-600">{openTasks}</div>
            <div className="text-sm text-emerald-700">Open Tasks</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-3xl font-bold text-slate-500">{closedTasks}</div>
            <div className="text-sm text-slate-600">Closed Tasks</div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Users Section */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Users</h2>
              <Link
                href="/admin/users/invite"
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                + Invite User
              </Link>
            </div>

            {!profiles || profiles.length === 0 ? (
              <p className="text-slate-500">No users yet. Profiles are created on first login.</p>
            ) : (
              <div className="space-y-3">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-3"
                  >
                    <div>
                      <div className="font-medium text-slate-900">
                        {profile.full_name || profile.email}
                      </div>
                      <div className="text-sm text-slate-500">{profile.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          profile.role === "admin"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {profile.role || "user"}
                      </span>
                      <Link
                        href={`/admin/users/${profile.id}`}
                        className="text-sm text-slate-500 hover:text-slate-900"
                      >
                        Edit →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Log */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Recent Activity
            </h2>

            {!typedActivity || typedActivity.length === 0 ? (
              <p className="text-slate-500">
                No activity recorded yet. Changes will appear here as users interact with tasks.
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {typedActivity.map((activity) => {
                  const userName =
                    activity.profiles?.full_name ||
                    activity.profiles?.email ||
                    "Unknown user";
                  const timeAgo = getTimeAgo(activity.created_at);

                  return (
                    <div
                      key={activity.id}
                      className="border-b border-slate-100 pb-3 last:border-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-medium text-slate-900">
                            {userName}
                          </span>
                          <span className="text-slate-600">
                            {" "}
                            {formatAction(activity.action, activity.entity_type)}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {timeAgo}
                        </span>
                      </div>
                      {activity.new_values && (
                        <div className="mt-1 text-sm text-slate-500">
                          {summarizeChanges(activity.old_values, activity.new_values)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatAction(action: string, entityType: string): string {
  const actionMap: Record<string, string> = {
    create: "created",
    update: "updated",
    delete: "deleted",
    close: "closed",
    reopen: "reopened",
  };
  const formattedAction = actionMap[action] || action;
  return `${formattedAction} a ${entityType}`;
}

function summarizeChanges(
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null
): string {
  if (!newValues) return "";
  
  const changes: string[] = [];
  const keys = Object.keys(newValues);
  
  for (const key of keys.slice(0, 3)) {
    if (key === "id" || key === "created_at" || key === "updated_at") continue;
    const newVal = newValues[key];
    const oldVal = oldValues?.[key];
    
    if (oldVal !== undefined && oldVal !== newVal) {
      changes.push(`${key}: ${String(oldVal)} → ${String(newVal)}`);
    } else if (oldVal === undefined) {
      changes.push(`${key}: ${String(newVal)}`);
    }
  }
  
  if (keys.length > 3) {
    changes.push(`+${keys.length - 3} more`);
  }
  
  return changes.join(", ");
}

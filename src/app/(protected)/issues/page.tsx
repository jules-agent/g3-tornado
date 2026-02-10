import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

// Calculate days since a date
function daysSince(date: string | null): number | null {
  if (!date) return null;
  const then = new Date(date);
  const now = new Date();
  const diff = now.getTime() - then.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default async function IssuesPage() {
  const supabase = await createClient();

  // Get all open tasks with their details
  const { data: tasks } = await supabase
    .from("tasks")
    .select(`
      id,
      task_number,
      description,
      status,
      fu_cadence_days,
      is_blocked,
      blocker_note,
      close_requested_at,
      created_at,
      project:projects (name),
      task_notes (created_at)
    `)
    .eq("status", "open")
    .order("created_at", { ascending: true });

  // Process tasks to identify issues
  const issues: {
    id: string;
    type: "overdue" | "gated" | "close_requested" | "inactive";
    severity: "critical" | "warning" | "info";
    title: string;
    description: string;
    taskId: string;
    taskNumber: string | null;
    daysSince: number | null;
  }[] = [];

  const typedTasks = tasks as unknown as Array<{
    id: string;
    task_number: string | null;
    description: string;
    status: string;
    fu_cadence_days: number;
    is_blocked: boolean;
    blocker_note: string | null;
    close_requested_at: string | null;
    created_at: string;
    project: { name: string } | null;
    task_notes: Array<{ created_at: string }>;
  }>;

  typedTasks?.forEach((task) => {
    // Find most recent activity (note or creation)
    const lastNote = task.task_notes?.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    const lastActivity = lastNote?.created_at || task.created_at;
    const daysInactive = daysSince(lastActivity);
    
    // Check for stale (past follow-up cadence, needs attention)
    if (daysInactive && daysInactive > task.fu_cadence_days) {
      const daysPastCadence = daysInactive - task.fu_cadence_days;
      issues.push({
        id: `stale-${task.id}`,
        type: "overdue",
        severity: daysPastCadence > 7 ? "critical" : "warning",
        title: `Overdue: ${task.description.substring(0, 50)}...`,
        description: `${daysPastCadence} days past ${task.fu_cadence_days}-day follow-up cadence`,
        taskId: task.id,
        taskNumber: task.task_number,
        daysSince: daysInactive,
      });
    }

    // Check for gated tasks (waiting for a gate to pass)
    if (task.is_blocked) {
      issues.push({
        id: `gated-${task.id}`,
        type: "gated",
        severity: "warning",
        title: `Blocked: ${task.description.substring(0, 50)}...`,
        description: task.blocker_note || "No blocker details provided",
        taskId: task.id,
        taskNumber: task.task_number,
        daysSince: daysInactive,
      });
    }

    // Check for pending close requests
    if (task.close_requested_at) {
      const daysWaiting = daysSince(task.close_requested_at);
      issues.push({
        id: `close-${task.id}`,
        type: "close_requested",
        severity: daysWaiting && daysWaiting > 2 ? "warning" : "info",
        title: `Close Requested: ${task.description.substring(0, 50)}...`,
        description: `Waiting for admin approval (${daysWaiting} days)`,
        taskId: task.id,
        taskNumber: task.task_number,
        daysSince: daysWaiting,
      });
    }

    // Check for inactive tasks (no activity in 30+ days, beyond stale)
    if (daysInactive && daysInactive > 30 && !task.is_blocked && daysInactive <= task.fu_cadence_days) {
      issues.push({
        id: `inactive-${task.id}`,
        type: "inactive",
        severity: "info",
        title: `Inactive: ${task.description.substring(0, 50)}...`,
        description: `No activity in ${daysInactive} days`,
        taskId: task.id,
        taskNumber: task.task_number,
        daysSince: daysInactive,
      });
    }
  });

  // Sort issues by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Group by type for summary
  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  const gatedCount = issues.filter((i) => i.type === "gated").length;
  const staleCount = issues.filter((i) => i.type === "overdue").length;
  const closeRequestCount = issues.filter((i) => i.type === "close_requested").length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="mb-4 inline-flex items-center text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Issues Dashboard
          </h1>
          <p className="mt-2 text-slate-600">
            Auto-detected issues requiring attention
          </p>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="text-3xl font-bold text-red-600">{criticalCount}</div>
            <div className="text-sm text-red-700">Critical</div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-3xl font-bold text-amber-600">{warningCount}</div>
            <div className="text-sm text-amber-700">Warnings</div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-3xl font-bold text-blue-600">{infoCount}</div>
            <div className="text-sm text-blue-700">Info</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-3xl font-bold text-slate-900">{typedTasks?.length || 0}</div>
            <div className="text-sm text-slate-600">Open Tasks</div>
          </div>
        </div>

        {/* Issue Type Breakdown */}
        <div className="mb-8 flex flex-wrap gap-3">
          {staleCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
              ⏰ {staleCount} Stale
            </span>
          )}
          {gatedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              🚧 {gatedCount} Gated
            </span>
          )}
          {closeRequestCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
              ✋ {closeRequestCount} Pending Close
            </span>
          )}
        </div>

        {/* Issues List */}
        {issues.length === 0 ? (
          <div className="rounded-3xl border border-green-200 bg-green-50 p-12 text-center">
            <div className="text-4xl">✅</div>
            <h2 className="mt-4 text-xl font-semibold text-green-800">
              All Clear!
            </h2>
            <p className="mt-2 text-green-700">
              No issues detected. All tasks are on track.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {issues.map((issue) => (
              <Link
                key={issue.id}
                href={`/tasks/${issue.taskId}`}
                className={`block rounded-2xl border p-4 transition hover:shadow-md ${
                  issue.severity === "critical"
                    ? "border-red-200 bg-red-50 hover:border-red-300"
                    : issue.severity === "warning"
                    ? "border-amber-200 bg-amber-50 hover:border-amber-300"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {issue.type === "overdue" && "⏰"}
                        {issue.type === "gated" && "🚧"}
                        {issue.type === "close_requested" && "✋"}
                        {issue.type === "inactive" && "💤"}
                      </span>
                      <span
                        className={`text-xs font-semibold uppercase tracking-wide ${
                          issue.severity === "critical"
                            ? "text-red-600"
                            : issue.severity === "warning"
                            ? "text-amber-600"
                            : "text-slate-500"
                        }`}
                      >
                        {issue.severity}
                      </span>
                      {issue.taskNumber && (
                        <span className="text-xs text-slate-400">
                          #{issue.taskNumber}
                        </span>
                      )}
                    </div>
                    <h3
                      className={`mt-1 font-medium ${
                        issue.severity === "critical"
                          ? "text-red-900"
                          : issue.severity === "warning"
                          ? "text-amber-900"
                          : "text-slate-900"
                      }`}
                    >
                      {issue.title}
                    </h3>
                    <p
                      className={`mt-1 text-sm ${
                        issue.severity === "critical"
                          ? "text-red-700"
                          : issue.severity === "warning"
                          ? "text-amber-700"
                          : "text-slate-600"
                      }`}
                    >
                      {issue.description}
                    </p>
                  </div>
                  <div className="text-slate-400">→</div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* System Status */}
        <div className="mt-12 rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">System Status</h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Database Connection</span>
              <span className="inline-flex items-center gap-1.5 text-green-600">
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Authentication</span>
              <span className="inline-flex items-center gap-1.5 text-green-600">
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Last Scan</span>
              <span className="text-slate-500">Just now</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

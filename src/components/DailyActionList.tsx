"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type ActionItem = {
  taskId: string;
  taskNumber: string;
  description: string;
  projectName: string;
  daysOverdue: number;
  isBlocked: boolean;
  blockerDescription: string | null;
  gatePerson: string | null;
  nextStep: string | null;
  ownerNames: string;
  action: string; // computed recommended action
};

export function DailyActionList({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    const fetchData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("owner_id, role").eq("id", user.id).maybeSingle();
      const isAdmin = profile?.role === "admin" || user.email === "ben@unpluggedperformance.com";
      const userOwnerId = profile?.owner_id;

      const { data: tasks } = await supabase
        .from("tasks")
        .select(`
          id, task_number, description, status, fu_cadence_days, last_movement_at,
          is_blocked, blocker_description, next_step, gates,
          projects (id, name),
          task_owners (owner_id, owners (id, name))
        `)
        .eq("status", "open")
        .order("last_movement_at", { ascending: true });

      if (!tasks) { setItems([]); setLoading(false); return; }

      const actionItems: ActionItem[] = [];

      for (const task of tasks as any[]) {
        const daysSince = Math.floor(
          (Date.now() - new Date(task.last_movement_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSince <= task.fu_cadence_days) continue; // not overdue

        const ownerIds = task.task_owners?.map((to: any) => to.owner_id).filter(Boolean) || [];
        const isMyTask = userOwnerId ? ownerIds.includes(userOwnerId) : false;

        // Non-admin: only show own tasks
        if (!isAdmin && !isMyTask) continue;

        const ownerNames = task.task_owners?.map((to: any) => to.owners?.name).filter(Boolean).join(", ") || "Unassigned";
        const projectName = task.projects?.name || "No project";

        // Determine gate person from gates array
        let gatePerson: string | null = null;
        if (task.gates && Array.isArray(task.gates) && task.gates.length > 0) {
          const activeGate = task.gates.find((g: any) => !g.completed);
          if (activeGate) gatePerson = activeGate.owner_name || null;
        }

        // Compute recommended action
        let action: string;
        if (task.is_blocked && gatePerson) {
          action = `📞 Contact ${gatePerson}` + (task.blocker_description ? ` — ${task.blocker_description}` : "");
        } else if (task.is_blocked && task.blocker_description) {
          action = `🚧 Resolve blocker: ${task.blocker_description}`;
        } else if (task.next_step) {
          action = `➡️ ${task.next_step}`;
        } else {
          action = `🔄 Follow up — ${daysSince} days without movement`;
        }

        actionItems.push({
          taskId: task.id,
          taskNumber: task.task_number || "—",
          description: task.description,
          projectName,
          daysOverdue: daysSince - task.fu_cadence_days,
          isBlocked: task.is_blocked,
          blockerDescription: task.blocker_description,
          gatePerson,
          nextStep: task.next_step,
          ownerNames,
          action,
        });
      }

      // Sort by most overdue first
      actionItems.sort((a, b) => b.daysOverdue - a.daysOverdue);
      setItems(actionItems);
      setLoading(false);
    };

    fetchData();
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const content = (
    <div
      className="fixed inset-0 z-[9999] bg-white dark:bg-slate-950 overflow-y-auto"
      style={{ isolation: "isolate" }}
    >
      {/* Lock body scroll */}
      <style>{`body { overflow: hidden !important; }`}</style>

      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">📋</span>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Today&apos;s Actions</h1>
            <p className="text-xs text-slate-500">{items.length} overdue task{items.length !== 1 ? "s" : ""} need attention</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition"
        >
          ← Back to Tasks
        </button>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">All caught up!</h2>
            <p className="text-slate-500">No overdue tasks today. Great work.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={item.taskId}
                className={`rounded-xl border p-4 transition hover:shadow-md ${
                  item.isBlocked
                    ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Number */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400">
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-mono text-slate-400">{item.taskNumber}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">{item.projectName}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        item.daysOverdue > 7
                          ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
                          : "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300"
                      }`}>
                        {item.daysOverdue}d overdue
                      </span>
                      {item.isBlocked && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 font-semibold">
                          🚧 GATED
                        </span>
                      )}
                    </div>

                    {/* Task description */}
                    <p className="text-sm text-slate-800 dark:text-slate-200 mb-2 line-clamp-2">
                      {item.description}
                    </p>

                    {/* Recommended action — the key part */}
                    <div className="rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400 mb-0.5">
                        Action for today
                      </div>
                      <p className="text-sm font-medium text-teal-900 dark:text-teal-100">
                        {item.action}
                      </p>
                    </div>

                    {/* Owner + link */}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-slate-400">Owners: {item.ownerNames}</span>
                      <Link
                        href={`/tasks/${item.taskId}`}
                        onClick={onClose}
                        className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                      >
                        Open →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Future automation teaser */}
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                🤖 <span className="font-semibold">Coming soon:</span> Auto-contact gate blockers and send follow-up reminders on your behalf
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

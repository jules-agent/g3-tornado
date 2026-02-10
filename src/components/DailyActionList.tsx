"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { capitalizeFirst } from "@/lib/utils";

type Owner = {
  id: string;
  name: string;
};

type Gate = {
  name: string;
  owner_name: string;
  task_name?: string;
  completed: boolean;
};

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
  action: string;
  fuCadenceDays: number;
  gates: Gate[];
};

type ExpandedState = "none" | "manage";

function ActionCard({ item, onUpdate }: { item: ActionItem; onUpdate: () => void }) {
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedState>("none");
  const [cadenceDays, setCadenceDays] = useState(item.fuCadenceDays);
  const [cadenceChanged, setCadenceChanged] = useState(false);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [blockerOwner, setBlockerOwner] = useState("");
  const [blockerDesc, setBlockerDesc] = useState("");
  const [blockerPosition, setBlockerPosition] = useState(item.gates.length);
  const [savingChanges, setSavingChanges] = useState(false);
  const [closingTask, setClosingTask] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const cadenceInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  // Load owners when manage panel opens
  useEffect(() => {
    if (expanded !== "manage") return;
    async function loadOwners() {
      const { data } = await supabase.from("owners").select("id, name").order("name");
      setOwners(data || []);
    }
    loadOwners();
  }, [expanded, supabase]);

  async function handleNoteSubmit() {
    if (!noteText.trim() || saving) return;
    setSaving(true);

    const { error: noteError } = await supabase.from("task_notes").insert({
      task_id: item.taskId,
      content: noteText.trim(),
    });

    if (!noteError) {
      await supabase
        .from("tasks")
        .update({ last_movement_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", item.taskId);

      setNoteText("");
      setNoteSaved(true);
      setExpanded("manage");
    }
    setSaving(false);
  }

  function handleCadenceChange(val: number) {
    const clamped = Math.max(1, Math.min(365, val));
    setCadenceDays(clamped);
    setCadenceChanged(clamped !== item.fuCadenceDays);
  }

  async function handleCloseTask() {
    setClosingTask(true);
    await supabase
      .from("tasks")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", item.taskId);
    setClosingTask(false);
    onUpdate();
  }

  async function handleSaveAll() {
    setSavingChanges(true);

    // Save cadence if changed
    if (cadenceChanged) {
      await supabase
        .from("tasks")
        .update({ fu_cadence_days: cadenceDays, updated_at: new Date().toISOString() })
        .eq("id", item.taskId);
    }

    // Save blocker if filled
    if (blockerOwner) {
      const newGate: Gate = {
        name: `Gate ${item.gates.length + 1}`,
        owner_name: blockerOwner,
        task_name: blockerDesc || undefined,
        completed: false,
      };

      const updatedGates = [...item.gates];
      updatedGates.splice(blockerPosition, 0, newGate);
      updatedGates.forEach((g, i) => {
        g.name = `Gate ${i + 1}`;
      });

      await supabase
        .from("tasks")
        .update({
          gates: updatedGates,
          is_blocked: updatedGates.some((g) => !g.completed && g.owner_name),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.taskId);
    }

    setSavingChanges(false);
    setExpanded("none");
    setCadenceChanged(false);
    setBlockerOwner("");
    setBlockerDesc("");
    setNoteSaved(false);
    onUpdate();
  }

  const hasChanges = cadenceChanged || !!blockerOwner;

  return (
    <div
      className={`rounded-xl border p-4 transition hover:shadow-md ${
        item.isBlocked
          ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-mono text-slate-400">{item.taskNumber}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
              {capitalizeFirst(item.projectName)}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                item.daysOverdue > 7
                  ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
                  : "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300"
              }`}
            >
              {item.daysOverdue}d overdue
            </span>
            {item.isBlocked && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 font-semibold">
                🚧 Gated
              </span>
            )}
          </div>

          {/* Task description */}
          <p className="text-sm text-slate-800 dark:text-slate-200 mb-2 line-clamp-2">
            {capitalizeFirst(item.description)}
          </p>

          {/* Recommended action */}
          <div className="rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 px-3 py-2 mb-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400 mb-0.5">
              Action for today
            </div>
            <p className="text-sm font-medium text-teal-900 dark:text-teal-100">
              {capitalizeFirst(item.action)}
            </p>
          </div>

          {/* Quick note input */}
          <div className="mb-2">
            <div className="flex gap-2">
              <input
                ref={noteInputRef}
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && noteText.trim()) {
                    e.preventDefault();
                    handleNoteSubmit();
                  }
                }}
                placeholder="Submit an update note..."
                disabled={saving}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50"
              />
              {noteText.trim() && (
                <button
                  onClick={handleNoteSubmit}
                  disabled={saving}
                  className="px-3 py-2 bg-teal-500 text-white rounded-lg text-xs font-semibold hover:bg-teal-600 disabled:opacity-50 transition flex-shrink-0"
                >
                  {saving ? "..." : "Submit"}
                </button>
              )}
            </div>

            {/* Note saved confirmation */}
            {noteSaved && (
              <div className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ Note saved & movement updated
              </div>
            )}
          </div>

          {/* Manage panel — cadence + blocker together, no auto-submit, no timeout */}
          {expanded === "manage" && (
            <div className="space-y-3 mb-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 animate-in fade-in slide-in-from-top-1 duration-200">
              {/* Cadence section */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  📅 Follow-up Cadence
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => handleCadenceChange(cadenceDays - 1)}
                    className="w-10 h-10 flex items-center justify-center text-lg font-bold rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition select-none"
                  >
                    −
                  </button>
                  <input
                    ref={cadenceInputRef}
                    type="number"
                    min={1}
                    max={365}
                    value={cadenceDays}
                    onChange={(e) => handleCadenceChange(parseInt(e.target.value) || 1)}
                    className="w-20 h-10 px-2 text-center text-lg font-bold border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => handleCadenceChange(cadenceDays + 1)}
                    className="w-10 h-10 flex items-center justify-center text-lg font-bold rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition select-none"
                  >
                    +
                  </button>
                  <span className="text-sm text-slate-500 dark:text-slate-400 ml-1">days</span>
                  {cadenceChanged && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium ml-1">
                      changed from {item.fuCadenceDays}d
                    </span>
                  )}
                </div>
              </div>

              {/* Blocker section */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  🚧 Add Blocker (optional)
                </label>
                <div className="mt-1 space-y-1.5">
                  <select
                    value={blockerOwner}
                    onChange={(e) => setBlockerOwner(e.target.value)}
                    className="w-full px-2 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Select gate person...</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.name}>
                        {capitalizeFirst(o.name)}
                      </option>
                    ))}
                  </select>
                  {blockerOwner && (
                    <>
                      <input
                        type="text"
                        value={blockerDesc}
                        onChange={(e) => setBlockerDesc(e.target.value)}
                        placeholder="What do they need to do?"
                        className="w-full px-2 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      {item.gates.length > 0 && (
                        <select
                          value={blockerPosition}
                          onChange={(e) => setBlockerPosition(parseInt(e.target.value))}
                          className="w-full px-2 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          <option value={0}>Before all existing gates</option>
                          {item.gates.map((g, i) => (
                            <option key={i} value={i + 1}>
                              After {capitalizeFirst(g.owner_name)} — {capitalizeFirst(g.task_name || "gate")}
                            </option>
                          ))}
                        </select>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Action buttons — explicit save only */}
              <div className="flex gap-2 pt-1">
                {hasChanges && (
                  <button
                    onClick={handleSaveAll}
                    disabled={savingChanges}
                    className="flex-1 px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 transition"
                  >
                    {savingChanges ? "Saving..." : "Save Changes"}
                  </button>
                )}
                <button
                  onClick={() => {
                    setExpanded("none");
                    setCadenceDays(item.fuCadenceDays);
                    setCadenceChanged(false);
                    setBlockerOwner("");
                    setBlockerDesc("");
                    setNoteSaved(false);
                  }}
                  className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                >
                  {hasChanges ? "Discard" : "Close"}
                </button>
              </div>
            </div>
          )}

          {/* Contact + Close Task + Open link */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400">
              Contacts: {capitalizeFirst(item.ownerNames)}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCloseTask}
                disabled={closingTask}
                className="text-xs font-semibold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 transition"
              >
                {closingTask ? "Closing..." : "Close Task"}
              </button>
              <Link
                href={`/tasks/${item.taskId}`}
                className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
              >
                Open →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DailyActionList({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    const fetchData = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("owner_id, role")
        .eq("id", user.id)
        .maybeSingle();
      const isAdmin = profile?.role === "admin" || user.email === "ben@unpluggedperformance.com";
      const userOwnerId = profile?.owner_id;

      const { data: tasks } = await supabase
        .from("tasks")
        .select(
          `
          id, task_number, description, status, fu_cadence_days, last_movement_at,
          is_blocked, blocker_description, next_step, gates,
          projects (id, name),
          task_owners (owner_id, owners (id, name))
        `
        )
        .eq("status", "open")
        .order("last_movement_at", { ascending: true });

      if (!tasks) {
        setItems([]);
        setLoading(false);
        return;
      }

      const actionItems: ActionItem[] = [];

      for (const task of tasks as any[]) {
        const daysSince = Math.floor(
          (Date.now() - new Date(task.last_movement_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSince <= task.fu_cadence_days) continue;

        const ownerIds = task.task_owners?.map((to: any) => to.owner_id).filter(Boolean) || [];
        const isMyTask = userOwnerId ? ownerIds.includes(userOwnerId) : false;

        if (!isAdmin && !isMyTask) continue;

        const ownerNames =
          task.task_owners
            ?.map((to: any) => to.owners?.name)
            .filter(Boolean)
            .join(", ") || "Unassigned";
        const projectName = task.projects?.name || "No project";

        let gatePerson: string | null = null;
        const gates: Gate[] = (task.gates && Array.isArray(task.gates) ? task.gates : []) as Gate[];
        if (gates.length > 0) {
          const activeGate = gates.find((g) => !g.completed);
          if (activeGate) gatePerson = activeGate.owner_name || null;
        }

        let action: string;
        if (task.is_blocked && gatePerson) {
          action = `📞 Contact ${gatePerson}${task.blocker_description ? ` — ${task.blocker_description}` : ""}`;
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
          fuCadenceDays: task.fu_cadence_days,
          gates,
        });
      }

      actionItems.sort((a, b) => b.daysOverdue - a.daysOverdue);
      setItems(actionItems);
      setLoading(false);
    };

    fetchData();
  }, [isOpen, refreshKey]);

  if (!isOpen || !mounted) return null;

  const content = (
    <div
      className="fixed left-0 right-0 bottom-0 z-[100] bg-white dark:bg-slate-950 overflow-y-auto"
      style={{ isolation: "isolate", top: "var(--header-height, 57px)" }}
    >
      {/* Sub-header for Daily Actions */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">📋</span>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Today&apos;s Actions</h1>
            <p className="text-xs text-slate-500">
              {items.length} overdue task{items.length !== 1 ? "s" : ""} need attention
            </p>
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
            {items.map((item) => (
              <ActionCard key={item.taskId} item={item} onUpdate={() => setRefreshKey((k) => k + 1)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

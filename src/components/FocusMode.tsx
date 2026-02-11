"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RestartClockModal } from "./RestartClockModal";
import SpeechInput from "@/components/SpeechInput";

type Gate = {
  name: string;
  owner_name: string;
  task_name?: string;
  completed: boolean;
};

type Task = {
  id: string;
  description: string;
  status: string;
  is_blocked: boolean;
  fu_cadence_days: number;
  daysSinceMovement: number;
  task_number: string | null;
  projects: { id: string; name: string } | null;
  ownerNames: string;
  isOverdue: boolean;
  isMyTask: boolean;
  gates: Gate[] | null;
  next_step: string | null;
};

function getCurrentGatePerson(gates: Gate[] | null): string | null {
  if (!gates) return null;
  const current = gates.find((g) => !g.completed);
  return current?.owner_name || null;
}

function getNextGatePerson(gates: Gate[] | null): string | null {
  if (!gates) return null;
  const incomplete = gates.filter((g) => !g.completed);
  return incomplete.length > 1 ? incomplete[1]?.owner_name || null : null;
}

export function FocusMode({ isOpen, onClose, tasks }: { isOpen: boolean; onClose: () => void; tasks: Task[] }) {
  const router = useRouter();
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [showRestartClock, setShowRestartClock] = useState(false);
  const [pendingNoteTaskId, setPendingNoteTaskId] = useState<string | null>(null);
  const [pendingNoteCadence, setPendingNoteCadence] = useState<number>(1);
  const [managingGates, setManagingGates] = useState<string | null>(null);
  const [editGates, setEditGates] = useState<Gate[]>([]);
  const [newGateName, setNewGateName] = useState("");
  const [newGateOwner, setNewGateOwner] = useState("");
  const [savingGates, setSavingGates] = useState(false);

  // Get overdue tasks sorted by priority, grouped by gate person
  const focusedTasks = useMemo(() => {
    const overdueTasks = tasks
      .filter((t) => t.isOverdue && !completedIds.has(t.id))
      .sort((a, b) => b.daysSinceMovement - a.daysSinceMovement);

    if (overdueTasks.length <= 3) return overdueTasks.slice(0, 3);

    // Try to group by common current + next gate person
    const grouped: Map<string, Task[]> = new Map();
    for (const t of overdueTasks) {
      const currentGate = getCurrentGatePerson(t.gates) || "none";
      const nextGate = getNextGatePerson(t.gates) || "none";
      const key = `${currentGate}|${nextGate}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(t);
    }

    // Find group of 3 with same current+next gate
    for (const [, group] of grouped) {
      if (group.length >= 3) return group.slice(0, 3);
    }

    // Fall back to same current gate
    const byCurrentGate: Map<string, Task[]> = new Map();
    for (const t of overdueTasks) {
      const currentGate = getCurrentGatePerson(t.gates) || "none";
      if (!byCurrentGate.has(currentGate)) byCurrentGate.set(currentGate, []);
      byCurrentGate.get(currentGate)!.push(t);
    }

    for (const [, group] of byCurrentGate) {
      if (group.length >= 3) return group.slice(0, 3);
    }

    // Fall back to top 3 most overdue
    return overdueTasks.slice(0, 3);
  }, [tasks, completedIds]);

  const addNote = useCallback(async (taskId: string, taskCadence: number) => {
    if (!noteValue.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("task_notes").insert({
      task_id: taskId,
      content: noteValue.trim(),
    });
    setSaving(false);
    setEditingNote(null);
    setNoteValue("");
    setCompletedIds((prev) => new Set([...prev, taskId]));
    
    // Show restart clock modal
    setPendingNoteTaskId(taskId);
    setPendingNoteCadence(taskCadence);
    setShowRestartClock(true);
  }, [noteValue]);

  const handleRestartClockConfirm = useCallback(async (newCadenceDays: number) => {
    if (!pendingNoteTaskId) return;
    
    const supabase = createClient();
    await supabase
      .from("tasks")
      .update({
        last_movement_at: new Date().toISOString(),
        fu_cadence_days: newCadenceDays,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pendingNoteTaskId);

    setShowRestartClock(false);
    setPendingNoteTaskId(null);
    router.refresh();
  }, [pendingNoteTaskId, router]);

  const handleRestartClockCancel = useCallback(() => {
    setShowRestartClock(false);
    setPendingNoteTaskId(null);
    router.refresh();
  }, [router]);

  // Gate management
  const startGateManagement = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId) || focusedTasks.find(t => t.id === taskId);
    if (task?.gates) {
      setEditGates([...task.gates]);
    } else {
      setEditGates([]);
    }
    setManagingGates(taskId);
    setNewGateName("");
    setNewGateOwner("");
  }, [tasks, focusedTasks]);

  const addGateToTask = useCallback(() => {
    if (!newGateName.trim()) return;
    setEditGates(prev => [...prev, {
      name: newGateName.trim(),
      owner_name: newGateOwner.trim(),
      completed: false,
    }]);
    setNewGateName("");
    setNewGateOwner("");
  }, [newGateName, newGateOwner]);

  const moveGate = useCallback((idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= editGates.length) return;
    const updated = [...editGates];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setEditGates(updated);
  }, [editGates]);

  const removeGate = useCallback((idx: number) => {
    setEditGates(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const saveGates = useCallback(async () => {
    if (!managingGates) return;
    setSavingGates(true);
    const supabase = createClient();
    await supabase
      .from("tasks")
      .update({ gates: editGates, updated_at: new Date().toISOString() })
      .eq("id", managingGates);
    setSavingGates(false);
    setManagingGates(null);
    router.refresh();
  }, [managingGates, editGates, router]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const overdueCount = tasks.filter((t) => t.isOverdue).length;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-slate-950">
      {/* Minimal top bar */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg">🎯</span>
          <div>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Focus Mode</h2>
            <p className="text-xs text-slate-400">
              {overdueCount} overdue · {completedIds.size} updated
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
        >
          ← Back to Tasks
        </button>
      </div>

      {/* Centered content */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        {focusedTasks.length === 0 ? (
          <div className="text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">All caught up!</h3>
            <p className="text-sm text-slate-400 mt-1">No overdue tasks need attention right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl w-full">
            {focusedTasks.map((task) => {
              const currentGate = getCurrentGatePerson(task.gates);
              const currentGateTask = task.gates?.find((g) => !g.completed)?.task_name;
              return (
                <div key={task.id} className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 p-5 flex flex-col">
                  {/* Project + Age */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400">
                      {task.projects?.name || "No project"}
                    </span>
                    <span className="text-xs font-semibold text-rose-400">
                      {task.daysSinceMovement}d overdue
                    </span>
                  </div>

                  {/* Task ID */}
                  {task.task_number && (
                    <span className="text-[10px] text-slate-300 dark:text-slate-500 font-mono">{task.task_number}</span>
                  )}

                  {/* Description */}
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-1 mb-3 line-clamp-3 leading-relaxed">
                    {task.description}
                  </p>

                  {/* Gate info */}
                  {currentGate && (
                    <div className="text-xs text-slate-400 mb-2">
                      <span className="font-medium text-slate-500 dark:text-slate-300">Gate:</span> {currentGate}
                      {currentGateTask && <span className="text-slate-300 dark:text-slate-500"> — {currentGateTask}</span>}
                    </div>
                  )}

                  {/* Next step */}
                  {task.next_step && (
                    <div className="text-xs text-teal-500 dark:text-teal-400 mb-3">
                      <span className="font-medium">Next:</span> {task.next_step}
                    </div>
                  )}

                  {/* Contacts */}
                  <div className="text-xs text-slate-400 mb-3">
                    👤 {task.ownerNames || "Unassigned"}
                  </div>

                  <div className="mt-auto pt-3 border-t border-slate-50 dark:border-slate-700/50">
                    {/* Gate management inline */}
                    {managingGates === task.id ? (
                      <div className="space-y-2">
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Gates</div>
                        {editGates.map((gate, idx) => (
                          <div key={idx} className={`flex items-center gap-1.5 text-xs ${gate.completed ? "opacity-40 line-through" : ""}`}>
                            <span className="text-slate-400 w-4">{idx + 1}.</span>
                            <span className="flex-1 text-slate-700 dark:text-slate-300 truncate">{gate.name}</span>
                            {gate.owner_name && <span className="text-slate-400 text-[10px]">→ {gate.owner_name}</span>}
                            <div className="flex gap-0.5">
                              <button onClick={() => moveGate(idx, -1)} disabled={idx === 0} className="text-[10px] text-slate-400 hover:text-slate-600 disabled:opacity-30">▲</button>
                              <button onClick={() => moveGate(idx, 1)} disabled={idx === editGates.length - 1} className="text-[10px] text-slate-400 hover:text-slate-600 disabled:opacity-30">▼</button>
                              {!gate.completed && <button onClick={() => removeGate(idx)} className="text-[10px] text-red-400 hover:text-red-600 ml-1">✕</button>}
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-1.5 pt-1">
                          <input
                            type="text"
                            value={newGateName}
                            onChange={(e) => setNewGateName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addGateToTask()}
                            placeholder="New gate..."
                            className="flex-1 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-400"
                          />
                          <input
                            type="text"
                            value={newGateOwner}
                            onChange={(e) => setNewGateOwner(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addGateToTask()}
                            placeholder="Who?"
                            className="w-20 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-400"
                          />
                          <button onClick={addGateToTask} disabled={!newGateName.trim()} className="text-teal-500 hover:text-teal-600 text-xs font-bold disabled:opacity-30">+</button>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={saveGates}
                            disabled={savingGates}
                            className="flex-1 rounded-lg bg-teal-500 text-white text-[11px] font-semibold py-1.5 hover:bg-teal-600 disabled:opacity-50 transition"
                          >
                            {savingGates ? "Saving..." : "Save Gates"}
                          </button>
                          <button onClick={() => setManagingGates(null)} className="text-[11px] text-slate-400 hover:text-slate-600">Cancel</button>
                        </div>
                      </div>
                    ) : editingNote === task.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={noteValue}
                          onChange={(e) => setNoteValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addNote(task.id, task.fu_cadence_days)}
                          placeholder="Add update note..."
                          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
                          autoFocus
                        />
                        <SpeechInput
                          onResult={(spoken) => setNoteValue(prev => prev ? prev + ' ' + spoken : spoken)}
                          disabled={saving}
                        />
                        <button
                          onClick={() => addNote(task.id, task.fu_cadence_days)}
                          disabled={saving || !noteValue.trim()}
                          className="px-2.5 py-1.5 rounded-lg bg-teal-500 text-white text-xs font-medium hover:bg-teal-600 disabled:opacity-50 transition"
                        >
                          {saving ? "..." : "✓"}
                        </button>
                        <button
                          onClick={() => { setEditingNote(null); setNoteValue(""); }}
                          className="text-slate-300 hover:text-slate-500 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingNote(task.id)}
                          className="flex-1 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-xs font-medium py-2 hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-teal-900/30 dark:hover:text-teal-300 transition"
                        >
                          📝 Update
                        </button>
                        <button
                          onClick={() => startGateManagement(task.id)}
                          className="rounded-lg bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-xs font-medium py-2 px-3 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300 transition"
                        >
                          🚦 Gates
                        </button>
                        <a
                          href={`/tasks/${task.id}`}
                          className="rounded-lg bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-xs font-medium py-2 px-3 hover:bg-slate-100 dark:hover:bg-slate-600 transition"
                        >
                          Open →
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Restart Clock Modal */}
      <RestartClockModal
        isOpen={showRestartClock}
        onConfirm={handleRestartClockConfirm}
        onCancel={handleRestartClockCancel}
        currentCadenceDays={pendingNoteCadence}
      />
    </div>,
    document.body
  );
}

// Standalone version that fetches its own data
export function FocusModeStandalone({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isOpen && !loaded) {
      fetchTasks();
    }
  }, [isOpen, loaded]);

  const fetchTasks = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let userOwnerId: string | null = null;
    let isAdmin = false;
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("owner_id, role, email").eq("id", user.id).maybeSingle();
      userOwnerId = profile?.owner_id ?? null;
      isAdmin = profile?.role === "admin" || profile?.email === "ben@unpluggedperformance.com";
    }

    const { data: allTasks } = await supabase
      .from("tasks")
      .select("id, description, status, is_blocked, fu_cadence_days, last_movement_at, created_at, task_number, project_id, gates, next_step, projects (id, name), task_owners (owner_id, owners (id, name))")
      .eq("status", "open")
      .order("last_movement_at", { ascending: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processed = (allTasks || []).map((task: any) => {
      const daysSinceMovement = Math.floor((Date.now() - new Date(task.last_movement_at).getTime()) / 86400000);
      const isOverdue = daysSinceMovement > task.fu_cadence_days;
      const taskOwners = task.task_owners || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ownerNames = taskOwners.map((to: any) => to.owners?.name).filter(Boolean).join(", ");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ownerIds = taskOwners.map((to: any) => to.owner_id).filter(Boolean);
      const isMyTask = userOwnerId ? ownerIds.includes(userOwnerId) : false;
      return { ...task, daysSinceMovement, daysSinceCreated: 0, isOverdue, ownerNames, ownerIds, isMyTask } as Task;
    });

    // Non-admin without owner_id sees nothing (not everything)
    const myTasks = isAdmin ? processed : userOwnerId ? processed.filter((t: Task) => t.isMyTask) : [];
    setTasks(myTasks);
    setLoaded(true);
  };

  // Reset on close so it refetches next time
  const handleClose = () => {
    setLoaded(false);
    onClose();
  };

  return <FocusMode isOpen={isOpen} onClose={handleClose} tasks={tasks} />;
}

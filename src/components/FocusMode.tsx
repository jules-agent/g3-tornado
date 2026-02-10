"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  isStale: boolean;
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

  // Get stale tasks sorted by priority, grouped by gate person
  const focusedTasks = useMemo(() => {
    const staleTasks = tasks
      .filter((t) => t.isStale && !completedIds.has(t.id))
      .sort((a, b) => b.daysSinceMovement - a.daysSinceMovement);

    if (staleTasks.length <= 3) return staleTasks.slice(0, 3);

    // Try to group by common current + next gate person
    const grouped: Map<string, Task[]> = new Map();
    for (const t of staleTasks) {
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
    for (const t of staleTasks) {
      const currentGate = getCurrentGatePerson(t.gates) || "none";
      if (!byCurrentGate.has(currentGate)) byCurrentGate.set(currentGate, []);
      byCurrentGate.get(currentGate)!.push(t);
    }

    for (const [, group] of byCurrentGate) {
      if (group.length >= 3) return group.slice(0, 3);
    }

    // Fall back to top 3 most overdue
    return staleTasks.slice(0, 3);
  }, [tasks, completedIds]);

  const addNote = useCallback(async (taskId: string) => {
    if (!noteValue.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("task_notes").insert({
      task_id: taskId,
      content: noteValue.trim(),
    });
    // Touch last_movement_at
    await supabase.from("tasks").update({ last_movement_at: new Date().toISOString() }).eq("id", taskId);
    setEditingNote(null);
    setNoteValue("");
    setSaving(false);
    setCompletedIds((prev) => new Set([...prev, taskId]));
    router.refresh();
  }, [noteValue, router]);

  if (!isOpen) return null;

  const staleCount = tasks.filter((t) => t.isStale).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-md" />
      <div className="relative w-full max-w-5xl mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">🎯 Focus Mode</h2>
            <p className="text-sm text-slate-400 mt-1">
              {staleCount} stale task{staleCount !== 1 ? "s" : ""} remaining · {completedIds.size} updated this session
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl transition">✕</button>
        </div>

        {/* Cards */}
        {focusedTasks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-white">All caught up!</h3>
            <p className="text-slate-400 mt-2">No stale tasks to focus on right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {focusedTasks.map((task) => {
              const currentGate = getCurrentGatePerson(task.gates);
              const currentGateTask = task.gates?.find((g) => !g.completed)?.task_name;
              return (
                <div key={task.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 flex flex-col">
                  {/* Project + Age */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {task.projects?.name || "No project"}
                    </span>
                    <span className="text-xs font-bold text-red-500">
                      {task.daysSinceMovement}d overdue
                    </span>
                  </div>

                  {/* Task ID */}
                  {task.task_number && (
                    <span className="text-[10px] text-slate-400 font-mono">{task.task_number}</span>
                  )}

                  {/* Description */}
                  <p className="text-sm font-medium text-slate-900 dark:text-white mt-1 mb-3 line-clamp-3">
                    {task.description}
                  </p>

                  {/* Gate info */}
                  {currentGate && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                      <span className="font-semibold">Gate:</span> {currentGate}
                      {currentGateTask && <span className="text-slate-400"> — {currentGateTask}</span>}
                    </div>
                  )}

                  {/* Next step */}
                  {task.next_step && (
                    <div className="text-xs text-teal-600 dark:text-teal-400 mb-3">
                      <span className="font-semibold">Next:</span> {task.next_step}
                    </div>
                  )}

                  {/* Owners */}
                  <div className="text-xs text-slate-400 mb-3">
                    👤 {task.ownerNames || "Unassigned"}
                  </div>

                  <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-700">
                    {editingNote === task.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={noteValue}
                          onChange={(e) => setNoteValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addNote(task.id)}
                          placeholder="Add update note..."
                          className="flex-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                          autoFocus
                        />
                        <button
                          onClick={() => addNote(task.id)}
                          disabled={saving || !noteValue.trim()}
                          className="px-2 py-1 rounded bg-teal-500 text-white text-xs font-semibold hover:bg-teal-600 disabled:opacity-50"
                        >
                          {saving ? "..." : "✓"}
                        </button>
                        <button
                          onClick={() => { setEditingNote(null); setNoteValue(""); }}
                          className="text-slate-400 hover:text-slate-600 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingNote(task.id)}
                          className="flex-1 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-semibold py-2 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition"
                        >
                          📝 Add Update
                        </button>
                        <a
                          href={`/tasks/${task.id}`}
                          className="rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold py-2 px-3 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
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
    </div>
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
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("owner_id").eq("id", user.id).maybeSingle();
      userOwnerId = profile?.owner_id ?? null;
    }

    const { data: allTasks } = await supabase
      .from("tasks")
      .select("id, description, status, is_blocked, fu_cadence_days, last_movement_at, created_at, task_number, project_id, gates, next_step, projects (id, name), task_owners (owner_id, owners (id, name))")
      .eq("status", "open")
      .order("last_movement_at", { ascending: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processed = (allTasks || []).map((task: any) => {
      const daysSinceMovement = Math.floor((Date.now() - new Date(task.last_movement_at).getTime()) / 86400000);
      const isStale = daysSinceMovement > task.fu_cadence_days;
      const taskOwners = task.task_owners || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ownerNames = taskOwners.map((to: any) => to.owners?.name).filter(Boolean).join(", ");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ownerIds = taskOwners.map((to: any) => to.owner_id).filter(Boolean);
      const isMyTask = userOwnerId ? ownerIds.includes(userOwnerId) : false;
      return { ...task, daysSinceMovement, daysSinceCreated: 0, isStale, ownerNames, ownerIds, isMyTask } as Task;
    });

    setTasks(processed);
    setLoaded(true);
  };

  // Reset on close so it refetches next time
  const handleClose = () => {
    setLoaded(false);
    onClose();
  };

  return <FocusMode isOpen={isOpen} onClose={handleClose} tasks={tasks} />;
}

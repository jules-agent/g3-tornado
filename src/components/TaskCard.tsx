"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { capitalizeFirst } from "@/lib/utils";

type Gate = {
  name: string;
  owner_name: string;
  task_name?: string;
  completed: boolean;
};

type TaskNote = {
  id: string;
  content: string;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
};

type Task = {
  id: string;
  description: string;
  status: string;
  is_blocked: boolean;
  fu_cadence_days: number;
  daysSinceMovement: number;
  daysSinceCreated: number;
  task_number: string | null;
  projects: { id: string; name: string } | null;
  ownerNames: string;
  ownerIds: string[];
  isStale: boolean;
  isMyTask: boolean;
  last_movement_at: string;
  created_at: string;
  gates: Gate[] | null;
  estimated_hours: number | null;
  next_step: string | null;
  notes: TaskNote[];
};

type TaskCardProps = {
  task: Task;
  canDelete: boolean;
  isAdmin: boolean;
  onRefresh: () => void;
};

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function TaskCard({ task, canDelete, isAdmin, onRefresh }: TaskCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const gates = task.gates || [];
  const completedGates = gates.filter(g => g.completed).length;
  const currentGate = gates.find(g => !g.completed);
  const hasOpenGates = gates.some(g => !g.completed);

  // Calculate aging color
  const agingRatio = task.fu_cadence_days > 0 ? task.daysSinceMovement / task.fu_cadence_days : 0;
  const agingColor = task.status === "closed" 
    ? "bg-emerald-500" 
    : agingRatio > 1 
      ? "bg-red-500" 
      : agingRatio > 0.75 
        ? "bg-amber-400" 
        : "bg-emerald-500";

  const handleCloseTask = async () => {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed", closed_at: new Date().toISOString() }),
    });
    if (res.ok) {
      setMenuOpen(false);
      onRefresh();
    }
  };

  const handleReopenTask = async () => {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open", closed_at: null }),
    });
    if (res.ok) {
      setMenuOpen(false);
      onRefresh();
    }
  };

  const handleRequestClose = async () => {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "close_requested", close_requested_at: new Date().toISOString() }),
    });
    if (res.ok) {
      setMenuOpen(false);
      onRefresh();
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 5000);
      return;
    }
    setDeleting(true);
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (res.ok) {
      onRefresh();
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || "Failed to delete task");
    }
    setDeleting(false);
  };

  let cardClasses = "relative bg-white dark:bg-slate-800 rounded-lg border shadow-sm transition-all active:scale-[0.98]";
  if (task.status === "closed") {
    cardClasses += " border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20";
  } else if (task.isStale && task.isMyTask) {
    cardClasses += " border-red-300 dark:border-red-800 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/20";
  } else if (task.isStale) {
    cardClasses += " border-amber-300 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10";
  } else if (task.is_blocked) {
    cardClasses += " border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/30";
  } else {
    cardClasses += " border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700";
  }

  return (
    <div className={cardClasses}>
      {/* Card Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <Link href={`/tasks/${task.id}`} className="flex-1 min-w-0">
          <h3 className={`text-base font-semibold leading-tight ${
            task.status === "closed" 
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-slate-900 dark:text-white"
          }`}>
            {capitalizeFirst(task.description)}
          </h3>
          {task.projects && (
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {capitalizeFirst(task.projects.name)}
            </p>
          )}
        </Link>

        {/* Menu Button */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>
          
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20 min-w-[180px] py-1">
                <Link
                  href={`/tasks/${task.id}`}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <span>📝</span> Edit Task
                </Link>
                <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                {task.status === "closed" ? (
                  <button
                    onClick={handleReopenTask}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-left"
                  >
                    <span>↩️</span> Reopen Task
                  </button>
                ) : task.status === "close_requested" ? (
                  <button
                    onClick={handleCloseTask}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-left"
                  >
                    <span>✅</span> Approve Close
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleRequestClose}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-left"
                    >
                      <span>🙋</span> Request Close
                    </button>
                    <button
                      onClick={handleCloseTask}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-left"
                    >
                      <span>✅</span> Close Task
                    </button>
                  </>
                )}
                {canDelete && (
                  <>
                    <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left ${
                        confirmDelete
                          ? "bg-red-600 text-white"
                          : "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                      } disabled:opacity-50`}
                    >
                      <span>🗑️</span> {deleting ? "Deleting..." : confirmDelete ? "Click to confirm" : "Delete Task"}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        {task.isStale && task.status !== "closed" && task.isMyTask && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
            🔥 URGENT
          </span>
        )}
        {task.isStale && task.status !== "closed" && !task.isMyTask && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-500 text-white">
            OVERDUE
          </span>
        )}
        {task.is_blocked && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-slate-400 text-white">
            GATED
          </span>
        )}
        {task.status === "closed" ? (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-white">
            ✓ DONE
          </span>
        ) : task.status === "close_requested" ? (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-500 text-white">
            PENDING
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-white">
            OPEN
          </span>
        )}
      </div>

      {/* Gate Progress */}
      {gates.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Gates: {completedGates}/{gates.length}
            </span>
            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all"
                style={{ width: `${(completedGates / gates.length) * 100}%` }}
              />
            </div>
          </div>
          {currentGate && (
            <div className="inline-flex flex-col px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Current: {capitalizeFirst(currentGate.owner_name)}
              </span>
              {currentGate.task_name && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                  {capitalizeFirst(currentGate.task_name)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Next Step */}
      {task.next_step && (
        <div className="px-4 pb-3">
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Next Step
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {capitalizeFirst(task.next_step)}
          </p>
        </div>
      )}

      {/* Latest Note */}
      {task.notes.length > 0 && (
        <div className="px-4 pb-3">
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <span>💬 Latest Update</span>
            {task.notes.length > 1 && (
              <span className="text-blue-500">({task.notes.length} total)</span>
            )}
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
            {capitalizeFirst(task.notes[0].content)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {task.notes[0].profiles?.full_name || task.notes[0].profiles?.email || "Unknown"} · {formatRelativeTime(task.notes[0].created_at)}
          </p>
        </div>
      )}

      {/* Footer Stats */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 rounded-b-lg">
        {/* Aging Indicator */}
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${agingColor}`} />
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {task.daysSinceMovement}d / {task.fu_cadence_days}d cadence
          </span>
        </div>
        
        {/* Owner */}
        {task.ownerNames && (
          <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[40%]">
            {capitalizeFirst(task.ownerNames)}
          </span>
        )}
      </div>
    </div>
  );
}

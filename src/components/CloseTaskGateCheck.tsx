"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

type Gate = {
  name: string;
  owner_name: string;
  task_name?: string;
  completed: boolean;
};

export function CloseTaskGateCheck({
  taskId,
  gates,
  onClose,
  onComplete,
}: {
  taskId: string;
  gates: Gate[];
  onClose: () => void;
  onComplete: () => void;
}) {
  const openGates = gates.filter(g => !g.completed);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const allChecked = openGates.every((_, i) => checked.has(i));

  const toggleCheck = (idx: number) => {
    const next = new Set(checked);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setChecked(next);
  };

  const handleConfirmClose = async () => {
    setSaving(true);
    const supabase = createClient();

    // Mark all gates as completed
    const updatedGates = gates.map(g => ({ ...g, completed: true }));

    const { data: { user } } = await supabase.auth.getUser();

    await supabase
      .from("tasks")
      .update({
        gates: updatedGates,
        is_blocked: false,
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    setSaving(false);
    onComplete();
  };

  if (typeof document === "undefined") return null;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md mx-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">Close Task — Confirm Gates</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Check off each open gate to confirm completion before closing.
          </p>
        </div>

        <div className="px-5 py-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {/* Already completed gates */}
          {gates.filter(g => g.completed).length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase text-emerald-600 mb-1">✅ Already Completed</p>
              {gates.map((g, i) => g.completed ? (
                <div key={i} className="flex items-center gap-2 py-1 text-xs text-slate-400 line-through">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 text-[10px]">✓</span>
                  {g.name || `Gate ${i + 1}`} {g.owner_name && `→ ${g.owner_name}`}
                </div>
              ) : null)}
            </div>
          )}

          {/* Open gates to check off */}
          {openGates.length > 0 ? (
            <>
              <p className="text-[10px] font-semibold uppercase text-amber-600 mb-1">⬜ Must Confirm</p>
              {openGates.map((g, i) => {
                const isChecked = checked.has(i);
                return (
                  <button
                    key={i}
                    onClick={() => toggleCheck(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 text-left transition ${
                      isChecked
                        ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                        : "border-slate-200 dark:border-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-[10px] flex-shrink-0 ${
                      isChecked
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 dark:border-slate-500"
                    }`}>
                      {isChecked && "✓"}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{g.name || `Gate ${i + 1}`}</p>
                      {g.owner_name && <p className="text-[10px] text-slate-400">→ {g.owner_name}{g.task_name ? `: ${g.task_name}` : ""}</p>}
                    </div>
                  </button>
                );
              })}
            </>
          ) : (
            <p className="text-sm text-emerald-600 text-center py-4">All gates already completed! Ready to close.</p>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex gap-2">
          <button
            onClick={handleConfirmClose}
            disabled={saving || (!allChecked && openGates.length > 0)}
            className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {saving ? "Closing..." : openGates.length === 0 ? "Close Task" : `Confirm & Close (${checked.size}/${openGates.length})`}
          </button>
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

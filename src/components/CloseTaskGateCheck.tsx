"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { RestartClockModal } from "./RestartClockModal";

type Gate = {
  name: string;
  owner_name: string;
  task_name?: string;
  completed: boolean;
};

export function CloseTaskGateCheck({
  taskId,
  gates,
  currentCadenceDays,
  onClose,
  onComplete,
}: {
  taskId: string;
  gates: Gate[];
  currentCadenceDays: number;
  onClose: () => void;
  onComplete: () => void;
}) {
  const openGates = gates.filter(g => !g.completed);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showRestartClock, setShowRestartClock] = useState(false);

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
    
    // Show restart clock modal
    setShowRestartClock(true);
  };

  const handleRestartClockConfirm = async (newCadenceDays: number) => {
    const supabase = createClient();
    await supabase
      .from("tasks")
      .update({
        last_movement_at: new Date().toISOString(),
        fu_cadence_days: newCadenceDays,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    setShowRestartClock(false);
    onComplete();
  };

  const handleRestartClockCancel = () => {
    setShowRestartClock(false);
    onComplete();
  };

  if (typeof document === "undefined") return null;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md md:max-w-lg rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Close Task — Confirm Gates</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Check off each open gate to confirm completion before closing.
          </p>
        </div>

        <div className="px-6 py-5 space-y-3 overflow-y-auto">
          {/* Already completed gates */}
          {gates.filter(g => g.completed).length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase text-emerald-600 mb-2">✅ Already Completed</p>
              {gates.map((g, i) => g.completed ? (
                <div key={i} className="flex items-center gap-3 py-2 text-sm text-slate-400 line-through">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 text-xs">✓</span>
                  {g.name || `Gate ${i + 1}`} {g.owner_name && `→ ${g.owner_name}`}
                </div>
              ) : null)}
            </div>
          )}

          {/* Open gates to check off */}
          {openGates.length > 0 ? (
            <>
              <p className="text-xs font-semibold uppercase text-amber-600 mb-3">⬜ Must Confirm</p>
              {openGates.map((g, i) => {
                const isChecked = checked.has(i);
                return (
                  <button
                    key={i}
                    onClick={() => toggleCheck(i)}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-left transition min-h-[64px] ${
                      isChecked
                        ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                        : "border-slate-200 dark:border-slate-600 hover:border-slate-300 active:bg-slate-50 dark:active:bg-slate-700"
                    }`}
                  >
                    <span className={`w-7 h-7 rounded border-2 flex items-center justify-center text-sm flex-shrink-0 ${
                      isChecked
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 dark:border-slate-500"
                    }`}>
                      {isChecked && "✓"}
                    </span>
                    <div>
                      <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{g.name || `Gate ${i + 1}`}</p>
                      {g.owner_name && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">→ {g.owner_name}{g.task_name ? `: ${g.task_name}` : ""}</p>}
                    </div>
                  </button>
                );
              })}
            </>
          ) : (
            <p className="text-base text-emerald-600 text-center py-6">All gates already completed! Ready to close.</p>
          )}
        </div>

        <div className="px-6 py-5 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleConfirmClose}
            disabled={saving || (!allChecked && openGates.length > 0)}
            className="flex-1 rounded-xl bg-emerald-500 px-6 py-4 text-base font-semibold text-white hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition min-h-[56px]"
          >
            {saving ? "Closing..." : openGates.length === 0 ? "Close Task" : `Confirm & Close (${checked.size}/${openGates.length})`}
          </button>
          <button onClick={onClose} className="rounded-xl px-6 py-4 text-base font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 transition min-h-[56px]">Cancel</button>
        </div>
      </div>

      {/* Restart Clock Modal */}
      <RestartClockModal
        isOpen={showRestartClock}
        onConfirm={handleRestartClockConfirm}
        onCancel={handleRestartClockCancel}
        currentCadenceDays={currentCadenceDays}
      />
    </div>
  );

  return createPortal(modal, document.body);
}

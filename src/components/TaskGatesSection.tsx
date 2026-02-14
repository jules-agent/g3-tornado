"use client";

import { useState } from "react";
import { GateEditor } from "./GateEditor";
import { useRouter } from "next/navigation";

type Gate = {
  name: string;
  owner_name: string;
  task_name?: string;
  completed: boolean;
};

type TaskGatesSectionProps = {
  taskId: string;
  gates: Gate[] | null;
  currentCadenceDays: number;
};

export function TaskGatesSection({ taskId, gates: initialGates, currentCadenceDays }: TaskGatesSectionProps) {
  const [showEditor, setShowEditor] = useState(false);
  const router = useRouter();
  
  const gates = initialGates || [];
  const completedCount = gates.filter(g => g.completed).length;
  const currentGate = gates.find(g => !g.completed);
  
  const handleSave = () => {
    router.refresh();
  };

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Gates</h2>
          {gates.length > 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {completedCount}/{gates.length} completed
              {currentGate && (
                <span> • Current: {currentGate.owner_name} {currentGate.task_name && `— ${currentGate.task_name}`}</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              No gates configured
            </p>
          )}
        </div>
        <button
          onClick={() => setShowEditor(true)}
          className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:border-teal-400 dark:hover:border-teal-600 hover:text-teal-600 dark:hover:text-teal-400 transition"
        >
          {gates.length > 0 ? "Manage Gates" : "Add Gates"}
        </button>
      </div>
      
      {gates.length > 0 && (
        <div className="space-y-2">
          {gates.map((gate, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 rounded-lg border p-3 transition ${
                gate.completed
                  ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20"
                  : !gates.slice(0, idx).some(g => !g.completed)
                    ? "border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/20 ring-1 ring-teal-400"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                  gate.completed
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : !gates.slice(0, idx).some(g => !g.completed)
                      ? "border-teal-500 text-teal-600 dark:text-teal-400"
                      : "border-slate-300 dark:border-slate-600 text-slate-400"
                }`}
              >
                {gate.completed ? "✓" : idx + 1}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {gate.owner_name || "Unassigned"}
                </div>
                {gate.task_name && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {gate.task_name}
                  </div>
                )}
              </div>
              {gate.completed && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Completed
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      
      {showEditor && (
        <GateEditor
          taskId={taskId}
          gateIndex={0}
          gates={gates}
          onClose={() => setShowEditor(false)}
          onSave={handleSave}
          currentCadenceDays={currentCadenceDays}
        />
      )}
    </div>
  );
}

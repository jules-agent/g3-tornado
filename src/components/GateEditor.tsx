"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { RestartClockModal } from "./RestartClockModal";

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

type GateEditorProps = {
  taskId: string;
  gateIndex: number; // kept for API compat but editor shows all gates
  gates: Gate[];
  onClose: () => void;
  onSave: (updatedGates: Gate[]) => void;
  currentCadenceDays: number;
};

export function GateEditor({ taskId, gates: initialGates, onClose, onSave, currentCadenceDays }: GateEditorProps) {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gates, setGates] = useState<Gate[]>(
    initialGates.length > 0 ? initialGates : [{ name: "", owner_name: "", task_name: "", completed: false }]
  );
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [addingForIdx, setAddingForIdx] = useState<number | null>(null);
  const [completingGateIdx, setCompletingGateIdx] = useState<number | null>(null);
  const [showRestartClock, setShowRestartClock] = useState(false);
  const [pendingGateCompletion, setPendingGateCompletion] = useState<number | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadOwners() {
      const { data } = await supabase.from("owners").select("id, name").order("name");
      setOwners(data || []);
      setLoading(false);
    }
    loadOwners();
  }, [supabase]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const updateGate = (idx: number, field: keyof Gate, value: string | boolean) => {
    const updated = [...gates];
    updated[idx] = { ...updated[idx], [field]: value };
    setGates(updated);
  };

  const addGate = () => {
    setGates([...gates, { name: "", owner_name: "", task_name: "", completed: false }]);
  };

  const removeGate = (idx: number) => {
    if (gates.length <= 1) return;
    setGates(gates.filter((_, i) => i !== idx));
  };

  const moveGate = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= gates.length) return;
    const updated = [...gates];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setGates(updated);
  };

  const toggleCompleted = (idx: number) => {
    const updated = [...gates];
    updated[idx] = { ...updated[idx], completed: !updated[idx].completed };
    setGates(updated);
  };

  async function handleAddOwner(idx: number) {
    if (!newOwnerName.trim()) return;
    const { data, error } = await supabase
      .from("owners")
      .insert({ name: newOwnerName.trim() })
      .select("id, name")
      .single();
    if (data && !error) {
      setOwners([...owners, data].sort((a, b) => a.name.localeCompare(b.name)));
      updateGate(idx, "owner_name", data.name);
      setNewOwnerName("");
      setShowAddOwner(false);
      setAddingForIdx(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    // Filter out completely empty gates
    const validGates = gates.filter(g => g.owner_name || g.name || g.task_name);

    const { error } = await supabase
      .from("tasks")
      .update({
        gates: validGates,
        is_blocked: validGates.some(g => !g.completed && g.owner_name),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    setSaving(false);
    if (!error) {
      onSave(validGates);
      onClose();
    }
  }

  // Complete gate with confirmation and clock restart
  const handleCompleteGate = (idx: number) => {
    setCompletingGateIdx(idx);
  };

  const confirmCompleteGate = async () => {
    if (completingGateIdx === null) return;
    
    // Mark gate as completed
    const updated = [...gates];
    updated[completingGateIdx] = { ...updated[completingGateIdx], completed: true };
    
    // Save to database
    setSaving(true);
    const validGates = updated.filter(g => g.owner_name || g.name || g.task_name);
    
    const { error } = await supabase
      .from("tasks")
      .update({
        gates: validGates,
        is_blocked: validGates.some(g => !g.completed && g.owner_name),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    setSaving(false);
    
    if (!error) {
      setGates(updated);
      setCompletingGateIdx(null);
      // Show restart clock modal
      setPendingGateCompletion(completingGateIdx);
      setShowRestartClock(true);
    }
  };

  const handleRestartClockConfirm = async (newCadenceDays: number) => {
    // Update last_movement_at and cadence
    await supabase
      .from("tasks")
      .update({
        last_movement_at: new Date().toISOString(),
        fu_cadence_days: newCadenceDays,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    setShowRestartClock(false);
    setPendingGateCompletion(null);
    onSave(gates);
    onClose();
  };

  const handleRestartClockCancel = () => {
    setShowRestartClock(false);
    setPendingGateCompletion(null);
    onSave(gates);
    onClose();
  };

  // Find current (first incomplete) gate index
  const currentGateIdx = gates.findIndex(g => !g.completed);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Gate Sequence</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {gates.filter(g => g.completed).length}/{gates.length} completed • Drag to reorder
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-lg">✕</button>
        </div>

        {/* Gate List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading ? (
            <div className="py-8 text-center text-slate-400">Loading...</div>
          ) : (
            gates.map((gate, idx) => {
              const isCurrent = idx === currentGateIdx;
              const isNext = idx === currentGateIdx + 1;
              return (
                <div
                  key={idx}
                  className={`rounded-lg border p-3 transition ${
                    gate.completed
                      ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20"
                      : isCurrent
                        ? "border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/20 ring-1 ring-teal-400"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {/* Gate label + status */}
                    <div className="flex flex-col items-center gap-1 pt-1 min-w-[52px]">
                      <button
                        onClick={() => toggleCompleted(idx)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition ${
                          gate.completed
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : isCurrent
                              ? "border-teal-500 text-teal-600"
                              : "border-slate-300 dark:border-slate-600 text-slate-400"
                        }`}
                        title={gate.completed ? "Mark incomplete" : "Mark complete"}
                      >
                        {gate.completed ? "✓" : idx + 1}
                      </button>
                      <span className={`text-[9px] font-bold uppercase leading-tight text-center ${
                        gate.completed ? "text-emerald-500" : isCurrent ? "text-teal-600" : isNext ? "text-slate-500" : "text-slate-400"
                      }`}>
                        Gate {idx + 1}
                        {isCurrent && !gate.completed && <><br /><span className="text-teal-500">Current</span></>}
                        {isNext && !gate.completed && <><br /><span className="text-slate-400">(Next)</span></>}
                      </span>
                    </div>

                    {/* Gate fields */}
                    <div className="flex-1 space-y-1.5">
                      <div className="flex gap-1.5">
                        {showAddOwner && addingForIdx === idx ? (
                          <div className="flex gap-1 flex-1">
                            <input
                              value={newOwnerName}
                              onChange={e => setNewOwnerName(e.target.value)}
                              placeholder="New person name..."
                              className="flex-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddOwner(idx);
                                }
                                if (e.key === "Escape") { 
                                  setShowAddOwner(false); 
                                  setAddingForIdx(null);
                                  setNewOwnerName("");
                                }
                              }}
                            />
                            <button onClick={() => handleAddOwner(idx)} className="px-2 py-1 bg-teal-500 text-white rounded text-xs font-semibold">Add</button>
                          </div>
                        ) : (
                          <select
                            value={gate.owner_name}
                            onChange={e => {
                              if (e.target.value === "__add__") {
                                setShowAddOwner(true);
                                setAddingForIdx(idx);
                              } else {
                                updateGate(idx, "owner_name", e.target.value);
                              }
                            }}
                            className="flex-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                          >
                            <option value="">Select person...</option>
                            {owners.map(o => (
                              <option key={o.id} value={o.name}>{o.name}</option>
                            ))}
                            <option value="__add__">+ Add new person...</option>
                          </select>
                        )}
                        <input
                          value={gate.task_name || ""}
                          onChange={e => updateGate(idx, "task_name", e.target.value)}
                          placeholder="What they do..."
                          className="flex-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      {/* Complete button for incomplete gates */}
                      {!gate.completed && (
                        <button
                          onClick={() => handleCompleteGate(idx)}
                          className="w-full rounded border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition flex items-center justify-center gap-1"
                          title="Complete this gate"
                        >
                          ✅ Complete Gate
                        </button>
                      )}
                    </div>

                    {/* Reorder + Delete */}
                    <div className="flex flex-col items-center gap-0.5 pt-1">
                      <button
                        onClick={() => moveGate(idx, -1)}
                        disabled={idx === 0}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-20 text-xs"
                        title="Move up"
                      >▲</button>
                      <button
                        onClick={() => moveGate(idx, 1)}
                        disabled={idx === gates.length - 1}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-20 text-xs"
                        title="Move down"
                      >▼</button>
                      {gates.length > 1 && (
                        <button
                          onClick={() => removeGate(idx)}
                          className="text-red-400 hover:text-red-600 text-xs mt-1"
                          title="Remove gate"
                        >✕</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
          <button
            onClick={addGate}
            className="w-full rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-600 px-3 py-2 text-xs font-semibold text-slate-500 hover:border-teal-400 hover:text-teal-600 transition"
          >
            + Add Gate
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50 transition"
            >
              {saving ? "Saving..." : "Save Gates"}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation modal for completing gate */}
      {completingGateIdx !== null && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setCompletingGateIdx(null)}
        >
          <div
            className="w-full max-w-sm mx-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white">Complete Gate?</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Are you sure you want to complete Gate {completingGateIdx + 1}?
              </p>
              <p className="text-xs text-slate-400 mt-2">
                {gates[completingGateIdx]?.owner_name && `${gates[completingGateIdx].owner_name}${gates[completingGateIdx]?.task_name ? ` — ${gates[completingGateIdx].task_name}` : ""}`}
              </p>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex gap-2">
              <button
                onClick={confirmCompleteGate}
                disabled={saving}
                className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition"
              >
                {saving ? "Completing..." : "Complete"}
              </button>
              <button
                onClick={() => setCompletingGateIdx(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restart Clock Modal */}
      <RestartClockModal
        isOpen={showRestartClock}
        onConfirm={handleRestartClockConfirm}
        onCancel={handleRestartClockCancel}
        currentCadenceDays={currentCadenceDays}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

type GateStep = {
  name: string;
  owner_name: string;
};

export function ProposeTemplate({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isUp, setIsUp] = useState(false);
  const [isBp, setIsBp] = useState(false);
  const [isUpfit, setIsUpfit] = useState(false);
  const [isBpas, setIsBpas] = useState(false);
  const [gates, setGates] = useState<GateStep[]>([{ name: "", owner_name: "" }]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addGate = () => setGates([...gates, { name: "", owner_name: "" }]);
  const removeGate = (idx: number) => setGates(gates.filter((_, i) => i !== idx));
  const updateGate = (idx: number, field: keyof GateStep, value: string) => {
    const updated = [...gates];
    updated[idx] = { ...updated[idx], [field]: value };
    setGates(updated);
  };
  const moveGate = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= gates.length) return;
    const updated = [...gates];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setGates(updated);
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Template name is required"); return; }
    const validGates = gates.filter(g => g.name.trim());
    if (validGates.length === 0) { setError("At least one gate step is required"); return; }
    if (!isUp && !isBp && !isUpfit && !isBpas) { setError("Select at least one company"); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          company_scope: { is_up: isUp, is_bp: isBp, is_upfit: isUpfit, is_bpas: isBpas },
          gates: validGates.map((g, i) => ({ ...g, order: i + 1, completed: false })),
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to submit");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  const reset = () => {
    setName(""); setDescription(""); setIsUp(false); setIsBp(false); setIsUpfit(false); setIsBpas(false);
    setGates([{ name: "", owner_name: "" }]); setSubmitted(false); setError(null);
  };

  if (!isOpen) return null;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">📋 Propose Template</h2>
          <button onClick={() => { reset(); onClose(); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg">&times;</button>
        </div>

        {submitted ? (
          <div className="px-5 py-10 text-center">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">✅ Template Proposed!</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              An admin will review and approve it. Track status on <a href="/my-reports" className="text-teal-600 font-semibold hover:underline">My Reports</a>.
            </p>
            <button onClick={() => { reset(); onClose(); }} className="mt-4 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">Close</button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                Template Name <span className="text-red-400">*</span>
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Parts Order Workflow, New Hire Onboarding"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                Description <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="When and why to use this template..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>

            {/* Company */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                Company <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                {[
                  { label: "UP", val: isUp, set: setIsUp },
                  { label: "BP", val: isBp, set: setIsBp },
                  { label: "UPFIT", val: isUpfit, set: setIsUpfit },
                  { label: "BPAS", val: isBpas, set: setIsBpas },
                ].map(({ label, val, set }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => set(!val)}
                    className={`rounded-lg px-4 py-2 text-xs font-bold border-2 transition ${
                      val ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white" : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-600 hover:border-slate-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Gate Steps */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Gate Sequence <span className="text-red-400">*</span>
              </label>
              <div className="space-y-2">
                {gates.map((gate, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 p-2">
                    <span className="text-xs font-bold text-slate-400 w-5 text-center">{idx + 1}</span>
                    <div className="flex-1 space-y-1">
                      <input
                        value={gate.name}
                        onChange={e => updateGate(idx, "name", e.target.value)}
                        placeholder="Gate description (e.g., Parts ordered)"
                        className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                      <input
                        value={gate.owner_name}
                        onChange={e => updateGate(idx, "owner_name", e.target.value)}
                        placeholder="Responsible person (e.g., Warehouse Manager)"
                        className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <button type="button" onClick={() => moveGate(idx, -1)} className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" title="Move up">▲</button>
                      <button type="button" onClick={() => moveGate(idx, 1)} className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" title="Move down">▼</button>
                    </div>
                    {gates.length > 1 && (
                      <button type="button" onClick={() => removeGate(idx)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addGate}
                className="mt-2 text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400"
              >
                + Add Gate Step
              </button>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-600 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="rounded-lg bg-teal-500 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50 transition"
              >
                {loading ? "Submitting..." : "Propose Template"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}

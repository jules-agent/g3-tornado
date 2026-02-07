"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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
  gateIndex: number;
  gates: Gate[];
  onClose: () => void;
  onSave: (updatedGates: Gate[]) => void;
};

export function GateEditor({ taskId, gateIndex, gates, onClose, onSave }: GateEditorProps) {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState("");
  
  const gate = gates[gateIndex] || { name: `Gate ${gateIndex + 1}`, owner_name: "", task_name: "", completed: false };
  const [ownerName, setOwnerName] = useState(gate.owner_name);
  const [taskName, setTaskName] = useState(gate.task_name || "");
  const [completed, setCompleted] = useState(gate.completed);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Load owners
  useEffect(() => {
    async function loadOwners() {
      const { data } = await supabase.from("owners").select("id, name").order("name");
      setOwners(data || []);
      setLoading(false);
    }
    loadOwners();
  }, [supabase]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  async function handleAddOwner() {
    if (!newOwnerName.trim()) return;
    
    const { data, error } = await supabase
      .from("owners")
      .insert({ name: newOwnerName.trim() })
      .select("id, name")
      .single();
    
    if (data && !error) {
      setOwners([...owners, data].sort((a, b) => a.name.localeCompare(b.name)));
      setOwnerName(data.name);
      setNewOwnerName("");
      setShowAddOwner(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    
    // Build updated gates array
    const updatedGates = [...gates];
    
    // If this gate index doesn't exist yet, fill in empty gates
    while (updatedGates.length <= gateIndex) {
      updatedGates.push({ name: `Gate ${updatedGates.length + 1}`, owner_name: "", task_name: "", completed: false });
    }
    
    updatedGates[gateIndex] = {
      name: gate.name || `Gate ${gateIndex + 1}`,
      owner_name: ownerName,
      task_name: taskName,
      completed: completed
    };
    
    // Remove empty trailing gates
    while (updatedGates.length > 0 && !updatedGates[updatedGates.length - 1].owner_name) {
      updatedGates.pop();
    }
    
    // Update in database
    const { error } = await supabase
      .from("tasks")
      .update({ 
        gates: updatedGates,
        is_blocked: updatedGates.some(g => !g.completed && g.owner_name),
        updated_at: new Date().toISOString()
      })
      .eq("id", taskId);
    
    setSaving(false);
    
    if (!error) {
      onSave(updatedGates);
      onClose();
    }
  }

  async function handleClearGate() {
    setSaving(true);
    
    const updatedGates = gates.filter((_, i) => i !== gateIndex);
    
    const { error } = await supabase
      .from("tasks")
      .update({ 
        gates: updatedGates,
        is_blocked: updatedGates.some(g => !g.completed && g.owner_name),
        updated_at: new Date().toISOString()
      })
      .eq("id", taskId);
    
    setSaving(false);
    
    if (!error) {
      onSave(updatedGates);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div 
        ref={modalRef}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 w-80 max-w-[90vw]"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Edit {gateIndex === 0 ? "Current" : "Next"} Gate
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            ✕
          </button>
        </div>
        
        {loading ? (
          <div className="py-8 text-center text-slate-400">Loading...</div>
        ) : (
          <div className="space-y-4">
            {/* Owner Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                Owner (person responsible)
              </label>
              {showAddOwner ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    placeholder="New owner name..."
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddOwner();
                      if (e.key === "Escape") setShowAddOwner(false);
                    }}
                  />
                  <button
                    onClick={handleAddOwner}
                    className="px-3 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <select
                    value={ownerName}
                    onChange={(e) => {
                      if (e.target.value === "__add_new__") {
                        setShowAddOwner(true);
                      } else {
                        setOwnerName(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Select owner...</option>
                    {owners.map((owner) => (
                      <option key={owner.id} value={owner.name}>
                        {owner.name}
                      </option>
                    ))}
                    <option value="__add_new__" className="text-teal-600 font-medium">
                      + Add new person...
                    </option>
                  </select>
                  <Link
                    href="/admin/owners"
                    target="_blank"
                    className="block text-right text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    Manage people list →
                  </Link>
                </div>
              )}
            </div>
            
            {/* Task Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                Task (what they need to do)
              </label>
              <input
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="e.g., Get Printer, Send Quote..."
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            
            {/* Completed Toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCompleted(!completed)}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  completed ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span 
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    completed ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {completed ? "Gate passed ✓" : "Gate pending"}
              </span>
            </div>
            
            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 transition"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {gate.owner_name && (
                <button
                  onClick={handleClearGate}
                  disabled={saving}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

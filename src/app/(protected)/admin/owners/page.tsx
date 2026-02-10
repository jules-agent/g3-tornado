"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Owner = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_internal: boolean;
  created_by_email: string | null;
  task_count?: number;
};

type EditingCell = {
  id: string;
  field: 'name' | 'email' | 'phone';
};

export default function ManageOwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newForm, setNewForm] = useState({ name: "", email: "", phone: "", is_internal: true });
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [merging, setMerging] = useState<{ sourceId: string; sourceName: string } | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  
  const supabase = createClient();

  useEffect(() => {
    loadOwners();
  }, []);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  async function loadOwners() {
    setLoading(true);
    
    const { data: ownersData } = await supabase
      .from("owners")
      .select("id, name, email, phone, is_internal, created_by_email")
      .order("name");
    
    const { data: taskOwners } = await supabase
      .from("task_owners")
      .select("owner_id");
    
    const countMap: Record<string, number> = {};
    taskOwners?.forEach(to => {
      countMap[to.owner_id] = (countMap[to.owner_id] || 0) + 1;
    });
    
    const withCounts = (ownersData || []).map(o => ({
      ...o,
      is_internal: o.is_internal ?? true,
      task_count: countMap[o.id] || 0
    }));
    
    setOwners(withCounts);
    setLoading(false);
  }

  async function handleAdd() {
    if (!newForm.name.trim()) return;
    setSaving(true);
    
    const { error } = await supabase
      .from("owners")
      .insert({ 
        name: newForm.name.trim(),
        email: newForm.email.trim() || null,
        phone: newForm.phone.trim() || null,
        is_internal: newForm.is_internal
      });
    
    if (!error) {
      setNewForm({ name: "", email: "", phone: "", is_internal: true });
      setShowAddForm(false);
      await loadOwners();
    }
    setSaving(false);
  }

  function startEditing(owner: Owner, field: 'name' | 'email' | 'phone') {
    setEditingCell({ id: owner.id, field });
    setEditValue(owner[field] || "");
  }

  async function saveCell() {
    if (!editingCell) return;
    
    const owner = owners.find(o => o.id === editingCell.id);
    if (!owner) return;

    // Name is required
    if (editingCell.field === 'name' && !editValue.trim()) {
      setEditingCell(null);
      return;
    }

    const oldValue = owner[editingCell.field];
    const newValue = editValue.trim() || null;
    
    // No change
    if (oldValue === newValue || (oldValue === null && newValue === "")) {
      setEditingCell(null);
      return;
    }

    setSaving(true);

    // Update in Supabase
    const updateData: Record<string, string | null> = {};
    updateData[editingCell.field] = editingCell.field === 'name' ? editValue.trim() : (editValue.trim() || null);
    
    const { error } = await supabase
      .from("owners")
      .update(updateData)
      .eq("id", editingCell.id);

    // If name changed, update gates
    if (!error && editingCell.field === 'name' && owner.name !== editValue.trim()) {
      const { data: tasks } = await supabase.from("tasks").select("id, gates");
      
      for (const task of tasks || []) {
        if (task.gates && Array.isArray(task.gates)) {
          let updated = false;
          const newGates = task.gates.map((gate: { owner_name: string }) => {
            if (gate.owner_name === owner.name) {
              updated = true;
              return { ...gate, owner_name: editValue.trim() };
            }
            return gate;
          });
          
          if (updated) {
            await supabase.from("tasks").update({ gates: newGates }).eq("id", task.id);
          }
        }
      }
    }

    setEditingCell(null);
    await loadOwners();
    setSaving(false);
  }

  async function toggleEmployee(owner: Owner) {
    setSaving(true);
    await supabase
      .from("owners")
      .update({ is_internal: !owner.is_internal })
      .eq("id", owner.id);
    await loadOwners();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const owner = owners.find(o => o.id === id);
    if (!owner) return;
    
    if (owner.task_count && owner.task_count > 0) {
      if (!confirm(`"${owner.name}" is assigned to ${owner.task_count} task(s). Delete anyway?`)) {
        return;
      }
    }
    
    setSaving(true);
    await supabase.from("task_owners").delete().eq("owner_id", id);
    await supabase.from("owners").delete().eq("id", id);
    await loadOwners();
    setSaving(false);
  }

  async function handleMerge() {
    if (!merging || !mergeTargetId || merging.sourceId === mergeTargetId) return;
    const target = owners.find(o => o.id === mergeTargetId);
    if (!target) return;
    if (!confirm(`Merge "${merging.sourceName}" into "${target.name}"? All tasks/gates will transfer to "${target.name}" and "${merging.sourceName}" will be deleted.`)) return;

    setSaving(true);

    // 1. Transfer task_owners
    await supabase.from("task_owners").update({ owner_id: mergeTargetId }).eq("owner_id", merging.sourceId);

    // 2. Update gates in all tasks
    const { data: tasks } = await supabase.from("tasks").select("id, gates");
    for (const task of tasks || []) {
      if (task.gates && Array.isArray(task.gates)) {
        let updated = false;
        const newGates = task.gates.map((gate: { owner_name: string }) => {
          if (gate.owner_name === merging.sourceName) {
            updated = true;
            return { ...gate, owner_name: target.name };
          }
          return gate;
        });
        if (updated) {
          await supabase.from("tasks").update({ gates: newGates }).eq("id", task.id);
        }
      }
    }

    // 3. Delete source owner
    await supabase.from("owners").delete().eq("id", merging.sourceId);

    setMerging(null);
    setMergeTargetId("");
    await loadOwners();
    setSaving(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      saveCell();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            ← Back to tasks
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            Manage People
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Click any cell to edit. Check the box to mark as UP/BP employee.
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 transition-colors"
          >
            + Add Person
          </button>
        )}
      </div>

      {/* Add new form */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Add New Person</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <input
              type="text"
              value={newForm.name}
              onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
              placeholder="Name *"
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              autoFocus
            />
            <input
              type="email"
              value={newForm.email}
              onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
              placeholder="Email"
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <input
              type="tel"
              value={newForm.phone}
              onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
              placeholder="Phone"
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <label className="flex items-center gap-2 px-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newForm.is_internal}
                onChange={(e) => setNewForm({ ...newForm, is_internal: e.target.checked })}
                className="w-5 h-5 rounded border-slate-300 text-teal-500 focus:ring-teal-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">UP/BP Employee</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !newForm.name.trim()}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 disabled:opacity-50 transition-colors"
            >
              Add Person
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewForm({ name: "", email: "", phone: "", is_internal: true });
              }}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : owners.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No people added yet.</div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-left text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3 font-semibold w-10 text-center">
                  <span title="UP/BP Employee">👔</span>
                </th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Created By</th>
                <th className="px-4 py-3 font-semibold text-center">Tasks</th>
                <th className="px-4 py-3 font-semibold w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {owners.map((owner) => (
                <tr 
                  key={owner.id} 
                  className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                    !owner.is_internal ? "bg-amber-50/50 dark:bg-amber-900/10" : ""
                  }`}
                >
                  {/* Employee checkbox */}
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={owner.is_internal}
                      onChange={() => toggleEmployee(owner)}
                      disabled={saving}
                      className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-teal-500 focus:ring-teal-500 cursor-pointer disabled:opacity-50"
                      title={owner.is_internal ? "UP/BP Employee" : "Outside Partner"}
                    />
                  </td>
                  
                  {/* Name - inline editable */}
                  <td className="px-4 py-3">
                    {editingCell?.id === owner.id && editingCell.field === 'name' ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveCell}
                        onKeyDown={handleKeyDown}
                        className="w-full px-2 py-1 border border-teal-400 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    ) : (
                      <span 
                        onClick={() => startEditing(owner, 'name')}
                        className="cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/30 px-2 py-1 -mx-2 rounded font-medium text-slate-900 dark:text-white transition-colors"
                      >
                        {owner.name}
                      </span>
                    )}
                  </td>
                  
                  {/* Email - inline editable */}
                  <td className="px-4 py-3">
                    {editingCell?.id === owner.id && editingCell.field === 'email' ? (
                      <input
                        ref={inputRef}
                        type="email"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveCell}
                        onKeyDown={handleKeyDown}
                        className="w-full px-2 py-1 border border-teal-400 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Add email..."
                      />
                    ) : (
                      <span 
                        onClick={() => startEditing(owner, 'email')}
                        className={`cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/30 px-2 py-1 -mx-2 rounded transition-colors ${
                          owner.email ? "text-slate-800 dark:text-slate-200" : "text-slate-400 dark:text-slate-500 italic"
                        }`}
                      >
                        {owner.email || "Add email..."}
                      </span>
                    )}
                  </td>
                  
                  {/* Phone - inline editable */}
                  <td className="px-4 py-3">
                    {editingCell?.id === owner.id && editingCell.field === 'phone' ? (
                      <input
                        ref={inputRef}
                        type="tel"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveCell}
                        onKeyDown={handleKeyDown}
                        className="w-full px-2 py-1 border border-teal-400 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Add phone..."
                      />
                    ) : (
                      <span 
                        onClick={() => startEditing(owner, 'phone')}
                        className={`cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/30 px-2 py-1 -mx-2 rounded transition-colors ${
                          owner.phone ? "text-slate-800 dark:text-slate-200" : "text-slate-400 dark:text-slate-500 italic"
                        }`}
                      >
                        {owner.phone || "Add phone..."}
                      </span>
                    )}
                  </td>
                  
                  {/* Created By */}
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {owner.created_by_email ? owner.created_by_email.split("@")[0] : "—"}
                  </td>

                  {/* Task count */}
                  <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-400">
                    {owner.task_count || 0}
                  </td>
                  
                  {/* Actions */}
                  <td className="px-4 py-3 flex gap-1">
                    <button
                      onClick={() => { setMerging({ sourceId: owner.id, sourceName: owner.name }); setMergeTargetId(""); }}
                      disabled={saving}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors disabled:opacity-50"
                      title="Merge into another contact"
                    >
                      🔀
                    </button>
                    <button
                      onClick={() => handleDelete(owner.id)}
                      disabled={saving}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Merge Modal */}
      {merging && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setMerging(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 w-96 max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 dark:text-white mb-1">Merge Contact</h3>
            <p className="text-xs text-slate-500 mb-4">
              Merge <strong>{merging.sourceName}</strong> into another contact. All tasks and gates will transfer.
            </p>
            <select
              value={mergeTargetId}
              onChange={e => setMergeTargetId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white mb-4"
            >
              <option value="">Select target contact...</option>
              {owners.filter(o => o.id !== merging.sourceId).map(o => (
                <option key={o.id} value={o.id}>{o.name} ({o.task_count || 0} tasks)</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={handleMerge} disabled={!mergeTargetId || saving} className="flex-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-40 transition">
                {saving ? "Merging..." : "Merge"}
              </button>
              <button onClick={() => setMerging(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded border border-slate-300 dark:border-slate-600 bg-teal-500 flex items-center justify-center text-white text-[10px]">✓</span>
          UP/BP Employee (can own tasks)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded border border-slate-300 dark:border-slate-600"></span>
          Outside Partner (gates only)
        </span>
      </div>
    </div>
  );
}

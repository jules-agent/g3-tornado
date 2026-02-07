"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Owner = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_internal: boolean;
  task_count?: number;
};

export default function ManageOwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", is_internal: true });
  const [newForm, setNewForm] = useState({ name: "", email: "", phone: "", is_internal: true });
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    loadOwners();
  }, []);

  async function loadOwners() {
    setLoading(true);
    
    // Get owners with all fields
    const { data: ownersData } = await supabase
      .from("owners")
      .select("id, name, email, phone, is_internal")
      .order("name");
    
    // Get task counts per owner
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

  async function handleSave(id: string) {
    if (!editForm.name.trim()) return;
    setSaving(true);
    
    const oldOwner = owners.find(o => o.id === id);
    
    // Update the owner
    const { error } = await supabase
      .from("owners")
      .update({ 
        name: editForm.name.trim(),
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        is_internal: editForm.is_internal
      })
      .eq("id", id);
    
    // If name changed, update any gate owner_names that match
    if (oldOwner && oldOwner.name !== editForm.name.trim() && !error) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, gates");
      
      for (const task of tasks || []) {
        if (task.gates && Array.isArray(task.gates)) {
          let updated = false;
          const newGates = task.gates.map((gate: { owner_name: string }) => {
            if (gate.owner_name === oldOwner.name) {
              updated = true;
              return { ...gate, owner_name: editForm.name.trim() };
            }
            return gate;
          });
          
          if (updated) {
            await supabase
              .from("tasks")
              .update({ gates: newGates })
              .eq("id", task.id);
          }
        }
      }
    }
    
    setEditingId(null);
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

  function startEdit(owner: Owner) {
    setEditingId(owner.id);
    setEditForm({
      name: owner.name,
      email: owner.email || "",
      phone: owner.phone || "",
      is_internal: owner.is_internal
    });
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            ← Back to tasks
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            Manage People
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage contacts for task owners and gates.
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600"
          >
            + Add Person
          </button>
        )}
      </div>

      {/* Add new form */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Add New Person</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              value={newForm.name}
              onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
              placeholder="Name *"
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              autoFocus
            />
            <input
              type="email"
              value={newForm.email}
              onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
              placeholder="Email"
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="tel"
              value={newForm.phone}
              onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
              placeholder="Phone"
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="new-type"
                  checked={newForm.is_internal}
                  onChange={() => setNewForm({ ...newForm, is_internal: true })}
                  className="w-4 h-4 text-teal-500 focus:ring-teal-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">UP/BP Employee</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="new-type"
                  checked={!newForm.is_internal}
                  onChange={() => setNewForm({ ...newForm, is_internal: false })}
                  className="w-4 h-4 text-teal-500 focus:ring-teal-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Outside Partner</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !newForm.name.trim()}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 disabled:opacity-50"
            >
              Add Person
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewForm({ name: "", email: "", phone: "", is_internal: true });
              }}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-teal-500"></span> UP/BP Employee
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span> Outside Partner
        </span>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : owners.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No people added yet.</div>
      ) : (
        <div className="space-y-2">
          {owners.map((owner) => (
            <div
              key={owner.id}
              className={`p-4 bg-white dark:bg-slate-800 border rounded-lg ${
                owner.is_internal 
                  ? "border-l-4 border-l-teal-500 border-slate-200 dark:border-slate-700" 
                  : "border-l-4 border-l-amber-500 border-slate-200 dark:border-slate-700"
              }`}
            >
              {editingId === owner.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="Name *"
                      className="px-3 py-2 border border-teal-300 dark:border-teal-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      autoFocus
                    />
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      placeholder="Email"
                      className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="Phone"
                      className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`edit-type-${owner.id}`}
                          checked={editForm.is_internal}
                          onChange={() => setEditForm({ ...editForm, is_internal: true })}
                          className="w-4 h-4 text-teal-500 focus:ring-teal-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">UP/BP Employee</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`edit-type-${owner.id}`}
                          checked={!editForm.is_internal}
                          onChange={() => setEditForm({ ...editForm, is_internal: false })}
                          className="w-4 h-4 text-teal-500 focus:ring-teal-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">Outside Partner</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(owner.id)}
                      disabled={saving || !editForm.name.trim()}
                      className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-white">{owner.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        owner.is_internal 
                          ? "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
                      }`}>
                        {owner.is_internal ? "Employee" : "Partner"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                      {owner.email && (
                        <a href={`mailto:${owner.email}`} className="hover:text-teal-600 dark:hover:text-teal-400">
                          📧 {owner.email}
                        </a>
                      )}
                      {owner.phone && (
                        <a href={`tel:${owner.phone}`} className="hover:text-teal-600 dark:hover:text-teal-400">
                          📱 {owner.phone}
                        </a>
                      )}
                      <span className="text-slate-400 dark:text-slate-500">
                        {owner.task_count} task{owner.task_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(owner)}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(owner.id)}
                      disabled={saving}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

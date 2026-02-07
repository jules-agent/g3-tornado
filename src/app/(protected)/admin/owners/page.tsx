"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Owner = {
  id: string;
  name: string;
  task_count?: number;
};

export default function ManageOwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    loadOwners();
  }, []);

  async function loadOwners() {
    setLoading(true);
    
    // Get owners with task count
    const { data: ownersData } = await supabase
      .from("owners")
      .select("id, name")
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
      task_count: countMap[o.id] || 0
    }));
    
    setOwners(withCounts);
    setLoading(false);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    
    const { error } = await supabase
      .from("owners")
      .insert({ name: newName.trim() });
    
    if (!error) {
      setNewName("");
      await loadOwners();
    }
    setSaving(false);
  }

  async function handleSave(id: string) {
    if (!editingName.trim()) return;
    setSaving(true);
    
    // Update the owner name
    const { error } = await supabase
      .from("owners")
      .update({ name: editingName.trim() })
      .eq("id", id);
    
    // Also update any gate owner_names that match the old name
    const oldOwner = owners.find(o => o.id === id);
    if (oldOwner && !error) {
      // Get all tasks and update gates with matching owner_name
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, gates");
      
      for (const task of tasks || []) {
        if (task.gates && Array.isArray(task.gates)) {
          let updated = false;
          const newGates = task.gates.map((gate: { owner_name: string }) => {
            if (gate.owner_name === oldOwner.name) {
              updated = true;
              return { ...gate, owner_name: editingName.trim() };
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
    setEditingName("");
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
    
    // Delete task_owners first (foreign key)
    await supabase.from("task_owners").delete().eq("owner_id", id);
    
    // Delete owner
    await supabase.from("owners").delete().eq("id", id);
    
    await loadOwners();
    setSaving(false);
  }

  function startEdit(owner: Owner) {
    setEditingId(owner.id);
    setEditingName(owner.name);
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            ← Back to tasks
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            Manage People
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Edit names here and all tasks will update automatically.
          </p>
        </div>
      </div>

      {/* Add new */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add new person..."
          className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={saving || !newName.trim()}
          className="px-4 py-2 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 disabled:opacity-50"
        >
          Add
        </button>
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
              className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              {editingId === owner.id ? (
                <>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-teal-300 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave(owner.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <button
                    onClick={() => handleSave(owner.id)}
                    disabled={saving}
                    className="px-3 py-1.5 bg-teal-500 text-white rounded text-sm font-medium hover:bg-teal-600 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-slate-900 dark:text-white">{owner.name}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {owner.task_count} task{owner.task_count !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => startEdit(owner)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(owner.id)}
                    disabled={saving}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded disabled:opacity-50"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

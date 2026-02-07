"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Owner = {
  id: string;
  name: string;
  is_internal: boolean;
};

type OwnerEditorProps = {
  taskId: string;
  onClose: () => void;
  onSave: () => void;
};

export function OwnerEditor({ taskId, onClose, onSave }: OwnerEditorProps) {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState("");
  
  const modalRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Load owners and current task owners
  useEffect(() => {
    async function loadData() {
      const [ownersResult, taskOwnersResult] = await Promise.all([
        // Only show UP/BP employees (is_internal = true), not outside partners
        supabase.from("owners").select("id, name, is_internal").eq("is_internal", true).order("name"),
        supabase.from("task_owners").select("owner_id").eq("task_id", taskId)
      ]);
      setOwners(ownersResult.data || []);
      setSelectedOwnerIds((taskOwnersResult.data || []).map(to => to.owner_id));
      setLoading(false);
    }
    loadData();
  }, [supabase, taskId]);

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
      .insert({ name: newOwnerName.trim(), is_internal: true })
      .select("id, name, is_internal")
      .single();
    
    if (data && !error) {
      setOwners([...owners, data].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedOwnerIds([...selectedOwnerIds, data.id]);
      setNewOwnerName("");
      setShowAddOwner(false);
    }
  }

  function toggleOwner(ownerId: string) {
    if (selectedOwnerIds.includes(ownerId)) {
      setSelectedOwnerIds(selectedOwnerIds.filter(id => id !== ownerId));
    } else {
      setSelectedOwnerIds([...selectedOwnerIds, ownerId]);
    }
  }

  async function handleSave() {
    setSaving(true);
    
    // Delete existing task_owners for this task
    await supabase.from("task_owners").delete().eq("task_id", taskId);
    
    // Insert new task_owners
    if (selectedOwnerIds.length > 0) {
      await supabase.from("task_owners").insert(
        selectedOwnerIds.map(ownerId => ({ task_id: taskId, owner_id: ownerId }))
      );
    }
    
    // Update task timestamp
    await supabase.from("tasks").update({ updated_at: new Date().toISOString() }).eq("id", taskId);
    
    setSaving(false);
    onSave();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div 
        ref={modalRef}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 w-72 max-w-[90vw]"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Assign Owners
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
          <div className="space-y-3">
            {/* Owner list with checkboxes */}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {owners.map((owner) => (
                <label
                  key={owner.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedOwnerIds.includes(owner.id)}
                    onChange={() => toggleOwner(owner.id)}
                    className="rounded border-slate-300 text-teal-500 focus:ring-teal-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-200">{owner.name}</span>
                </label>
              ))}
            </div>
            
            {/* Add new owner */}
            {showAddOwner ? (
              <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <input
                  type="text"
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  placeholder="New person name..."
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
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setShowAddOwner(true)}
                  className="flex-1 text-left px-2 py-1.5 text-sm text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded"
                >
                  + Add new person...
                </button>
                <Link
                  href="/admin/owners"
                  target="_blank"
                  className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                >
                  Manage list →
                </Link>
              </div>
            )}
            
            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 transition"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

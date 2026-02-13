"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { capitalizeFirst, validateContactAssociations, hasNoAssociations } from "@/lib/utils";

type Owner = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_internal: boolean;
  is_up_employee: boolean | null;
  is_bp_employee: boolean | null;
  is_upfit_employee: boolean | null;
  is_bpas_employee: boolean | null;
  is_third_party_vendor: boolean | null;
  created_by_email: string | null;
  is_private: boolean | null;
  private_owner_id: string | null;
  private_owner_name?: string | null;
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
  const [newForm, setNewForm] = useState({ 
    name: "", 
    email: "", 
    phone: "", 
    is_up: false,
    is_bp: false,
    is_upfit: false,
    is_bpas: false,
    is_vendor: false,
    is_private: false
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
      .select("id, name, email, phone, is_internal, is_up_employee, is_bp_employee, is_upfit_employee, is_bpas_employee, is_third_party_vendor, created_by_email, is_private, private_owner_id")
      .order("name");
    
    const { data: taskOwners } = await supabase
      .from("task_owners")
      .select("owner_id");
    
    const countMap: Record<string, number> = {};
    taskOwners?.forEach(to => {
      countMap[to.owner_id] = (countMap[to.owner_id] || 0) + 1;
    });
    
    // Get unique private_owner_ids to fetch profile names
    const privateOwnerIds = [...new Set(ownersData?.filter(o => o.private_owner_id).map(o => o.private_owner_id))] as string[];
    const profileNames: Record<string, string> = {};
    
    if (privateOwnerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", privateOwnerIds);
      
      profiles?.forEach(p => {
        profileNames[p.id] = p.email?.split("@")[0] || p.id;
      });
    }
    
    const withCounts = (ownersData || []).map(o => ({
      ...o,
      is_internal: o.is_internal ?? true,
      task_count: countMap[o.id] || 0,
      private_owner_name: o.private_owner_id ? profileNames[o.private_owner_id] : null
    }));
    
    // Sort: unassociated contacts first, then alphabetically
    const sorted = withCounts.sort((a, b) => {
      const aUnassociated = hasNoAssociations({
        is_up: a.is_up_employee || false,
        is_bp: a.is_bp_employee || false,
        is_upfit_employee: a.is_upfit_employee || false,
        is_bpas_employee: a.is_bpas_employee || false,
        is_third_party_vendor: a.is_third_party_vendor || false,
        is_private: a.is_private || false,
      });
      const bUnassociated = hasNoAssociations({
        is_up: b.is_up_employee || false,
        is_bp: b.is_bp_employee || false,
        is_upfit_employee: b.is_upfit_employee || false,
        is_bpas_employee: b.is_bpas_employee || false,
        is_third_party_vendor: b.is_third_party_vendor || false,
        is_private: b.is_private || false,
      });

      if (aUnassociated && !bUnassociated) return -1;
      if (!aUnassociated && bUnassociated) return 1;
      return a.name.localeCompare(b.name);
    });
    
    setOwners(sorted);
    setLoading(false);
  }

  async function handleAdd() {
    if (!newForm.name.trim()) {
      setError("Name is required");
      return;
    }

    // Validate associations
    const validation = validateContactAssociations({
      is_up: newForm.is_up,
      is_bp: newForm.is_bp,
      is_upfit_employee: newForm.is_upfit,
      is_bpas_employee: newForm.is_bpas,
      is_third_party_vendor: newForm.is_vendor,
      is_private: newForm.is_private,
    });

    if (!validation.valid) {
      setError(validation.error || "Invalid contact associations");
      return;
    }

    setSaving(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    // Get user's profile for email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();
    
    const { error: insertError } = await supabase
      .from("owners")
      .insert({ 
        name: capitalizeFirst(newForm.name.trim()),
        email: newForm.email.trim() || null,
        phone: newForm.phone.trim() || null,
        is_internal: newForm.is_up || newForm.is_bp || newForm.is_upfit || newForm.is_bpas,
        is_up_employee: newForm.is_up,
        is_bp_employee: newForm.is_bp,
        is_upfit_employee: newForm.is_upfit,
        is_bpas_employee: newForm.is_bpas,
        is_third_party_vendor: newForm.is_vendor,
        is_private: newForm.is_private,
        private_owner_id: newForm.is_private ? user.id : null,
        created_by: user.id,
        created_by_email: profile?.email || user.email || null,
      });
    
    if (!insertError) {
      setNewForm({ name: "", email: "", phone: "", is_up: false, is_bp: false, is_upfit: false, is_bpas: false, is_vendor: false, is_private: false });
      setShowAddForm(false);
      await loadOwners();
    } else {
      setError(insertError.message);
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
    updateData[editingCell.field] = editingCell.field === 'name' ? capitalizeFirst(editValue.trim()) : (editValue.trim() || null);
    
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
              return { ...gate, owner_name: capitalizeFirst(editValue.trim()) };
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

  async function toggleCompanyFlag(owner: Owner, flag: 'is_up_employee' | 'is_bp_employee' | 'is_upfit_employee' | 'is_bpas_employee' | 'is_third_party_vendor') {
    setSaving(true);
    const newValue = !owner[flag];
    
    // Calculate new is_internal value
    const newIsInternal = 
      (flag === 'is_up_employee' ? newValue : owner.is_up_employee) ||
      (flag === 'is_bp_employee' ? newValue : owner.is_bp_employee) ||
      (flag === 'is_upfit_employee' ? newValue : owner.is_upfit_employee) ||
      (flag === 'is_bpas_employee' ? newValue : owner.is_bpas_employee);

    await supabase
      .from("owners")
      .update({ 
        [flag]: newValue,
        is_internal: newIsInternal
      })
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
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            ← Back to tasks
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            Manage People (Admin)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Click any cell to edit. Admins see all contacts including private ones.
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
          
          {error && (
            <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-3 mb-3">
            <input
              type="text"
              value={newForm.name}
              onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
              placeholder="Name *"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5 block">Company Association *</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setNewForm({ ...newForm, is_up: !newForm.is_up })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${newForm.is_up ? "border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}>
                  {newForm.is_up ? "✓ " : ""}UP
                </button>
                <button type="button" onClick={() => setNewForm({ ...newForm, is_bp: !newForm.is_bp })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${newForm.is_bp ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}>
                  {newForm.is_bp ? "✓ " : ""}BP
                </button>
                <button type="button" onClick={() => setNewForm({ ...newForm, is_upfit: !newForm.is_upfit })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${newForm.is_upfit ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}>
                  {newForm.is_upfit ? "✓ " : ""}UPFIT
                </button>
                <button type="button" onClick={() => setNewForm({ ...newForm, is_bpas: !newForm.is_bpas })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${newForm.is_bpas ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}
                  title="Bulletproof Auto Spa">
                  {newForm.is_bpas ? "✓ " : ""}BPAS
                </button>
                <button type="button" onClick={() => setNewForm({ ...newForm, is_vendor: !newForm.is_vendor })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${newForm.is_vendor ? "border-slate-500 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}>
                  {newForm.is_vendor ? "✓ " : ""}3rd Party Vendor
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={newForm.is_private}
                  onChange={(e) => setNewForm({ ...newForm, is_private: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-teal-500 focus:ring-2 focus:ring-teal-500 focus:ring-offset-0"
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition">
                    🔒 Make Private
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Private contacts are hidden from other members
                  </p>
                </div>
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !newForm.name.trim()}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 disabled:opacity-50 transition-colors"
            >
              {saving ? "Adding..." : "Add Person"}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewForm({ name: "", email: "", phone: "", is_up: false, is_bp: false, is_upfit: false, is_bpas: false, is_vendor: false, is_private: false });
                setError("");
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
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Associations</th>
                <th className="px-4 py-3 font-semibold">Created By</th>
                <th className="px-4 py-3 font-semibold text-center">Tasks</th>
                <th className="px-4 py-3 font-semibold w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {owners.map((owner) => {
                const unassociated = hasNoAssociations({
                  is_up: owner.is_up_employee || false,
                  is_bp: owner.is_bp_employee || false,
                  is_upfit_employee: owner.is_upfit_employee || false,
                  is_bpas_employee: owner.is_bpas_employee || false,
                  is_third_party_vendor: owner.is_third_party_vendor || false,
                  is_private: owner.is_private || false,
                });

                return (
                  <tr 
                    key={owner.id} 
                    className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${unassociated ? "flash-red" : ""}`}
                  >
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
                        <div className="flex items-center gap-2">
                          {owner.is_private && (
                            <span className="text-xs" title={`Private to ${owner.private_owner_name || "unknown"}`}>
                              🔒
                            </span>
                          )}
                          <span 
                            onClick={() => startEditing(owner, 'name')}
                            className="cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/30 px-2 py-1 -mx-2 rounded font-medium text-slate-900 dark:text-white transition-colors"
                          >
                            {owner.name}
                          </span>
                          {owner.is_private && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                              Private to {owner.private_owner_name}
                            </span>
                          )}
                          {unassociated && (
                            <span className="text-xs text-red-600 dark:text-red-400">⚠️ No association</span>
                          )}
                        </div>
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
                    
                    {/* Associations - clickable badges to toggle */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => toggleCompanyFlag(owner, 'is_up_employee')}
                          disabled={saving}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all ${
                            owner.is_up_employee
                              ? "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 cursor-pointer hover:bg-teal-200"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-slate-200"
                          }`}
                        >
                          {owner.is_up_employee ? "✓ UP" : "UP"}
                        </button>
                        <button
                          onClick={() => toggleCompanyFlag(owner, 'is_bp_employee')}
                          disabled={saving}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all ${
                            owner.is_bp_employee
                              ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 cursor-pointer hover:bg-indigo-200"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-slate-200"
                          }`}
                        >
                          {owner.is_bp_employee ? "✓ BP" : "BP"}
                        </button>
                        <button
                          onClick={() => toggleCompanyFlag(owner, 'is_upfit_employee')}
                          disabled={saving}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all ${
                            owner.is_upfit_employee
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 cursor-pointer hover:bg-amber-200"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-slate-200"
                          }`}
                        >
                          {owner.is_upfit_employee ? "✓ UPFIT" : "UPFIT"}
                        </button>
                        <button
                          onClick={() => toggleCompanyFlag(owner, 'is_bpas_employee')}
                          disabled={saving}
                          title="Bulletproof Auto Spa"
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all ${
                            owner.is_bpas_employee
                              ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 cursor-pointer hover:bg-purple-200"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-slate-200"
                          }`}
                        >
                          {owner.is_bpas_employee ? "✓ BPAS" : "BPAS"}
                        </button>
                        <button
                          onClick={() => toggleCompanyFlag(owner, 'is_third_party_vendor')}
                          disabled={saving}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all ${
                            owner.is_third_party_vendor
                              ? "bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-slate-300"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-slate-200"
                          }`}
                        >
                          {owner.is_third_party_vendor ? "✓ Vendor" : "Vendor"}
                        </button>
                        {unassociated && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                            ⚠️ None
                          </span>
                        )}
                      </div>
                    </td>
                    
                    {/* Created By */}
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                        {owner.created_by_email ? owner.created_by_email.split("@")[0] : "—"}
                      </span>
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
                );
              })}
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
      <div className="mt-4 flex flex-col gap-2 text-xs text-slate-500 dark:text-slate-400">
        <div>Click company badges to toggle associations. All contacts must have at least one association.</div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded flash-red"></span>
          <span>Unassociated contacts (needs attention)</span>
        </div>
      </div>
    </div>
  );
}

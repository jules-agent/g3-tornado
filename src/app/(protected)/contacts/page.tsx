"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { capitalizeFirst, validateContactAssociations, hasNoAssociations, deriveContactType } from "@/lib/utils";

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
  created_by: string | null;
  created_by_email: string | null;
  is_private: boolean | null;
  private_owner_id: string | null;
};

type ContactType = 'employee' | 'vendor' | 'personal' | null;

type Profile = {
  id: string;
  email: string;
  role: string | null;
};

export default function ContactsPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newContactType, setNewContactType] = useState<ContactType>(null);
  const [newIsUp, setNewIsUp] = useState(false);
  const [newIsBp, setNewIsBp] = useState(false);
  const [newIsUpfit, setNewIsUpfit] = useState(false);
  const [newIsBpas, setNewIsBpas] = useState(false);
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editContactType, setEditContactType] = useState<ContactType>(null);
  const [editIsUp, setEditIsUp] = useState(false);
  const [editIsBp, setEditIsBp] = useState(false);
  const [editIsUpfit, setEditIsUpfit] = useState(false);
  const [editIsBpas, setEditIsBpas] = useState(false);
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [editError, setEditError] = useState("");

  const supabase = createClient();

  const filteredOwners = useMemo(() => {
    if (!searchQuery.trim()) return owners;
    const q = searchQuery.toLowerCase();
    return owners.filter(o =>
      o.name.toLowerCase().includes(q) ||
      (o.email && o.email.toLowerCase().includes(q)) ||
      (o.phone && o.phone.toLowerCase().includes(q))
    );
  }, [owners, searchQuery]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, role")
      .eq("id", user.id)
      .single();
    
    const isAdmin = profile?.role === "admin";
    setUserRole(profile?.role || null);

    const { data } = await supabase
      .from("owners")
      .select("id, name, email, phone, is_internal, is_up_employee, is_bp_employee, is_upfit_employee, is_bpas_employee, is_third_party_vendor, created_by, created_by_email, is_private, private_owner_id")
      .order("name");
    
    if (isAdmin) {
      const privateOwnerIds = (data || [])
        .filter(o => o.is_private && o.private_owner_id)
        .map(o => o.private_owner_id as string);
      
      if (privateOwnerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", privateOwnerIds);
        
        const nameMap: Record<string, string> = {};
        (profiles || []).forEach(p => {
          nameMap[p.id] = p.email.split("@")[0];
        });
        setOwnerNames(nameMap);
      }
    }
    
    const filtered = (data || []).filter(owner => {
      if (!owner.is_private) return true;
      if (isAdmin) return true;
      return owner.private_owner_id === user.id;
    });
    
    const sorted = filtered.sort((a, b) => {
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

  useEffect(() => { load(); }, []);

  function handleNewTypeSelect(type: ContactType) {
    if (type === 'personal') {
      setNewContactType('personal');
      setNewIsUp(false); setNewIsBp(false); setNewIsUpfit(false); setNewIsBpas(false);
      setNewIsPrivate(true);
    } else if (type === newContactType) {
      setNewContactType(null);
    } else {
      setNewContactType(type);
    }
  }

  function handleEditTypeSelect(type: ContactType) {
    if (type === 'personal') {
      setEditContactType('personal');
      setEditIsUp(false); setEditIsBp(false); setEditIsUpfit(false); setEditIsBpas(false);
      setEditIsPrivate(true);
    } else if (type === editContactType) {
      setEditContactType(null);
    } else {
      setEditContactType(type);
    }
  }

  async function handleAdd() {
    if (!newName.trim()) {
      setError("Name is required");
      return;
    }

    if (!newContactType) {
      setError("Please select a contact type (Employee, Vendor, or Personal)");
      return;
    }

    const isVendor = newContactType === 'vendor';
    const isPersonal = newContactType === 'personal';

    const validation = validateContactAssociations({
      is_up: newIsUp,
      is_bp: newIsBp,
      is_upfit: newIsUpfit,
      is_bpas: newIsBpas,
      is_third_party_vendor: isVendor,
      is_private: newIsPrivate || isPersonal,
      contactType: newContactType,
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();

    const finalIsPrivate = isPersonal || newIsPrivate;

    const { error: insertError } = await supabase.from("owners").insert({
      name: capitalizeFirst(newName.trim()),
      email: newEmail.trim() || null,
      phone: newPhone.trim() || null,
      is_internal: isPersonal ? false : (newIsUp || newIsBp || newIsUpfit || newIsBpas),
      is_up_employee: isPersonal ? false : newIsUp,
      is_bp_employee: isPersonal ? false : newIsBp,
      is_upfit_employee: isPersonal ? false : newIsUpfit,
      is_bpas_employee: isPersonal ? false : newIsBpas,
      is_third_party_vendor: isVendor,
      is_private: finalIsPrivate,
      private_owner_id: finalIsPrivate ? user.id : null,
      created_by: user.id,
      created_by_email: profile?.email || user.email || null,
    });

    if (!insertError) {
      setNewName(""); setNewEmail(""); setNewPhone("");
      setNewIsUp(false); setNewIsBp(false); setNewIsUpfit(false); setNewIsBpas(false);
      setNewIsPrivate(false); setNewContactType(null);
      setShowAdd(false);
      await load();
    } else {
      setError(insertError.message);
    }
    setSaving(false);
  }

  function startEdit(owner: Owner) {
    const derived = deriveContactType(owner);
    setEditingId(owner.id);
    setEditName(owner.name);
    setEditEmail(owner.email || "");
    setEditPhone(owner.phone || "");
    setEditIsUp(owner.is_up_employee || false);
    setEditIsBp(owner.is_bp_employee || false);
    setEditIsUpfit(owner.is_upfit_employee || false);
    setEditIsBpas(owner.is_bpas_employee || false);
    setEditIsPrivate(owner.is_private || false);
    setEditError("");
    
    // Derive contact type
    if (derived.isPersonal) {
      setEditContactType('personal');
    } else if (derived.isVendor) {
      setEditContactType('vendor');
    } else if (derived.isEmployee) {
      setEditContactType('employee');
    } else {
      setEditContactType(null);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError("");
  }

  async function handleEdit() {
    if (!editName.trim()) {
      setEditError("Name is required");
      return;
    }

    if (!editContactType) {
      setEditError("Please select a contact type");
      return;
    }

    const isVendor = editContactType === 'vendor';
    const isPersonal = editContactType === 'personal';

    const validation = validateContactAssociations({
      is_up: editIsUp,
      is_bp: editIsBp,
      is_upfit: editIsUpfit,
      is_bpas: editIsBpas,
      is_third_party_vendor: isVendor,
      is_private: editIsPrivate || isPersonal,
      contactType: editContactType,
    });

    if (!validation.valid) {
      setEditError(validation.error || "Invalid contact associations");
      return;
    }

    const owner = owners.find(o => o.id === editingId);
    if (!owner) return;

    const finalIsPrivate = isPersonal || editIsPrivate;

    // Check if user can modify private status
    if (finalIsPrivate && !owner.is_private && owner.created_by !== userId) {
      setEditError("You can only make private contacts that you created");
      return;
    }

    setSaving(true);
    setEditError("");

    const { error: updateError } = await supabase
      .from("owners")
      .update({
        name: capitalizeFirst(editName.trim()),
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        is_internal: isPersonal ? false : (editIsUp || editIsBp || editIsUpfit || editIsBpas),
        is_up_employee: isPersonal ? false : editIsUp,
        is_bp_employee: isPersonal ? false : editIsBp,
        is_upfit_employee: isPersonal ? false : editIsUpfit,
        is_bpas_employee: isPersonal ? false : editIsBpas,
        is_third_party_vendor: isVendor,
        is_private: finalIsPrivate,
        private_owner_id: finalIsPrivate ? (owner.private_owner_id || userId) : null,
      })
      .eq("id", editingId!);

    if (!updateError) {
      setEditingId(null);
      await load();
    } else {
      setEditError(updateError.message);
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-slate-900 rounded-full" /></div>;
  }

  const newShowCompany = newContactType === 'employee' || newContactType === 'vendor';
  const editShowCompany = editContactType === 'employee' || editContactType === 'vendor';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 pb-4 -mx-4 px-4 pt-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400">← Back to tasks</Link>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-2">📇 Contacts</h1>
            <p className="text-sm text-slate-500 mt-1">People you can assign as gate contacts or task owners.</p>
          </div>
          {!showAdd && (
            <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 transition text-sm">
              + Add Contact
            </button>
          )}
        </div>
        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          </div>
          <span className="text-xs text-slate-500">{filteredOwners.length} of {owners.length}</span>
        </div>
      </div>

      {showAdd && (
        <div className="mb-6 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 text-sm">New Contact</h3>
          
          {error && (
            <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-3 mb-3">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name *" autoFocus
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
            <div className="grid grid-cols-2 gap-3">
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email (optional)"
                className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone (optional)"
                className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>

            {/* Contact Type */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5 block">Contact Type *</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => handleNewTypeSelect('employee')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${newContactType === 'employee' ? "border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}>
                  {newContactType === 'employee' ? "✓ " : ""}👤 Employee
                </button>
                <button type="button" onClick={() => handleNewTypeSelect('vendor')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${newContactType === 'vendor' ? "border-slate-500 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}>
                  {newContactType === 'vendor' ? "✓ " : ""}🏢 Vendor
                </button>
                <button type="button" onClick={() => handleNewTypeSelect('personal')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${newContactType === 'personal' ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}>
                  {newContactType === 'personal' ? "✓ " : ""}🔒 Personal
                </button>
              </div>
              {newContactType === 'personal' && (
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1.5">Personal contacts are private and only visible to you and admins.</p>
              )}
            </div>

            {/* Company buttons */}
            {newShowCompany && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5 block">Company Association *</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setNewIsUp(!newIsUp)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${newIsUp ? "border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}>
                    {newIsUp ? "✓ " : ""}UP
                  </button>
                  <button type="button" onClick={() => setNewIsBp(!newIsBp)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${newIsBp ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}>
                    {newIsBp ? "✓ " : ""}BP
                  </button>
                  <button type="button" onClick={() => setNewIsUpfit(!newIsUpfit)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${newIsUpfit ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}>
                    {newIsUpfit ? "✓ " : ""}UPFIT
                  </button>
                  <button type="button" onClick={() => setNewIsBpas(!newIsBpas)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${newIsBpas ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}
                    title="Bulletproof Auto Spa">
                    {newIsBpas ? "✓ " : ""}BPAS
                  </button>
                </div>
              </div>
            )}

            {/* Private toggle */}
            {newContactType !== 'personal' && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={newIsPrivate}
                    onChange={e => setNewIsPrivate(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-teal-500 focus:ring-2 focus:ring-teal-500 focus:ring-offset-0"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition">
                      🔒 Make Private
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Private contacts are hidden from other members and only visible to your account
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !newName.trim() || !newContactType} className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-semibold hover:bg-teal-600 disabled:opacity-40 transition">
              {saving ? "Adding..." : "Add Contact"}
            </button>
            <button onClick={() => { setShowAdd(false); setNewName(""); setNewEmail(""); setNewPhone(""); setNewContactType(null); setNewIsUp(false); setNewIsBp(false); setNewIsUpfit(false); setNewIsBpas(false); setNewIsPrivate(false); setError(""); }} className="text-sm text-slate-500 hover:text-slate-700 px-3">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="sticky top-[120px] z-10">
            <tr className="bg-slate-50 dark:bg-slate-900/50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Type & Associations</th>
              <th className="px-4 py-3">Created By</th>
              <th className="px-4 py-3 w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredOwners.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  {searchQuery ? "No contacts match your search." : "No contacts yet."}
                </td>
              </tr>
            ) : filteredOwners.map(o => {
              const unassociated = hasNoAssociations({
                is_up: o.is_up_employee || false,
                is_bp: o.is_bp_employee || false,
                is_upfit_employee: o.is_upfit_employee || false,
                is_bpas_employee: o.is_bpas_employee || false,
                is_third_party_vendor: o.is_third_party_vendor || false,
                is_private: o.is_private || false,
              });
              const derived = deriveContactType(o);
              const canEdit = o.created_by === userId;
              const isEditing = editingId === o.id;

              return (
                <tr key={o.id} className={`${isEditing ? "" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"} transition ${unassociated ? "flash-red" : ""}`}>
                  {isEditing ? (
                    <td colSpan={6} className="px-4 py-4 bg-amber-50 dark:bg-amber-900/10">
                      <div className="max-w-2xl">
                        <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-3">✏️ Editing: {o.name}</h4>
                        
                        {editError && (
                          <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                            {editError}
                          </div>
                        )}

                        <div className="space-y-3">
                          <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name *"
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500" />
                          <div className="grid grid-cols-2 gap-3">
                            <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Email (optional)" type="email"
                              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500" />
                            <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Phone (optional)" type="tel"
                              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500" />
                          </div>

                          {/* Contact Type */}
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5 block">Contact Type *</label>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => handleEditTypeSelect('employee')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${editContactType === 'employee' ? "border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}>
                                {editContactType === 'employee' ? "✓ " : ""}👤 Employee
                              </button>
                              <button type="button" onClick={() => handleEditTypeSelect('vendor')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${editContactType === 'vendor' ? "border-slate-500 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}>
                                {editContactType === 'vendor' ? "✓ " : ""}🏢 Vendor
                              </button>
                              <button type="button" onClick={() => handleEditTypeSelect('personal')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${editContactType === 'personal' ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}>
                                {editContactType === 'personal' ? "✓ " : ""}🔒 Personal
                              </button>
                            </div>
                            {editContactType === 'personal' && (
                              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1.5">Personal contacts are private and only visible to you and admins.</p>
                            )}
                          </div>

                          {editShowCompany && (
                            <div>
                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5 block">Company Association *</label>
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => setEditIsUp(!editIsUp)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${editIsUp ? "border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}>
                                  {editIsUp ? "✓ " : ""}UP
                                </button>
                                <button type="button" onClick={() => setEditIsBp(!editIsBp)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${editIsBp ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}>
                                  {editIsBp ? "✓ " : ""}BP
                                </button>
                                <button type="button" onClick={() => setEditIsUpfit(!editIsUpfit)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${editIsUpfit ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}>
                                  {editIsUpfit ? "✓ " : ""}UPFIT
                                </button>
                                <button type="button" onClick={() => setEditIsBpas(!editIsBpas)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${editIsBpas ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}
                                  title="Bulletproof Auto Spa">
                                  {editIsBpas ? "✓ " : ""}BPAS
                                </button>
                              </div>
                            </div>
                          )}

                          {editContactType !== 'personal' && (
                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                              <label className="flex items-start gap-3 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={editIsPrivate}
                                  onChange={e => setEditIsPrivate(e.target.checked)}
                                  disabled={!o.is_private && o.created_by !== userId}
                                  className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-amber-500 focus:ring-2 focus:ring-amber-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                                    🔒 Make Private
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {!o.is_private && o.created_by !== userId
                                      ? "You can only make private contacts that you created"
                                      : "Private contacts are hidden from other members"}
                                  </p>
                                </div>
                              </label>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button onClick={handleEdit} disabled={saving || !editName.trim() || !editContactType}
                            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-40 transition">
                            {saving ? "Saving..." : "Save Changes"}
                          </button>
                          <button onClick={cancelEdit} className="text-sm text-slate-500 hover:text-slate-700 px-3">Cancel</button>
                        </div>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                        {o.is_private && <span className="mr-1.5" title="Private contact">🔒</span>}
                        {o.name}
                        {unassociated && <span className="ml-2 text-xs text-red-600 dark:text-red-400">⚠️ No type</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{o.email || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{o.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {/* Type badge */}
                          {derived.isEmployee && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                              Employee
                            </span>
                          )}
                          {derived.isVendor && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300">
                              Vendor
                            </span>
                          )}
                          {derived.isPersonal && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                              Personal
                            </span>
                          )}
                          {/* Company badges */}
                          {o.is_up_employee && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">UP</span>
                          )}
                          {o.is_bp_employee && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">BP</span>
                          )}
                          {o.is_upfit_employee && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">UPFIT</span>
                          )}
                          {o.is_bpas_employee && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" title="Bulletproof Auto Spa">BPAS</span>
                          )}
                          {o.is_private && !derived.isPersonal && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                              {userRole === "admin" && o.private_owner_id
                                ? `🔒 Private (${ownerNames[o.private_owner_id] || "unknown"})`
                                : "🔒 Private"}
                            </span>
                          )}
                          {unassociated && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">⚠️ None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                          {o.created_by_email ? o.created_by_email.split("@")[0] : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {canEdit && (
                          <button onClick={() => startEdit(o)} className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-semibold">
                            Edit
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
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
  is_third_party_vendor: boolean | null;
  created_by: string | null;
  created_by_email: string | null;
  is_private: boolean | null;
  private_owner_id: string | null;
};

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
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newIsUp, setNewIsUp] = useState(false);
  const [newIsBp, setNewIsBp] = useState(false);
  const [newIsUpfit, setNewIsUpfit] = useState(false);
  const [newIsVendor, setNewIsVendor] = useState(false);
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // Fetch current user's profile to get role
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, role")
      .eq("id", user.id)
      .single();
    
    const isAdmin = profile?.role === "admin";
    setUserRole(profile?.role || null);

    const { data } = await supabase
      .from("owners")
      .select("id, name, email, phone, is_internal, is_up_employee, is_bp_employee, is_upfit_employee, is_third_party_vendor, created_by, created_by_email, is_private, private_owner_id")
      .order("name");
    
    // For admins, fetch all owner profiles to map private_owner_id -> username
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
    
    // Filter private contacts: admins see all, regular users see only their own
    const filtered = (data || []).filter(owner => {
      if (!owner.is_private) return true; // Public contacts visible to all
      if (isAdmin) return true; // Admins see all contacts including private ones
      return owner.private_owner_id === user.id; // Regular users see only their private contacts
    });
    
    // Sort: unassociated contacts first, then alphabetically
    const sorted = filtered.sort((a, b) => {
      const aUnassociated = hasNoAssociations({
        is_up: a.is_up_employee || false,
        is_bp: a.is_bp_employee || false,
        is_upfit_employee: a.is_upfit_employee || false,
        is_third_party_vendor: a.is_third_party_vendor || false,
        is_private: a.is_private || false,
      });
      const bUnassociated = hasNoAssociations({
        is_up: b.is_up_employee || false,
        is_bp: b.is_bp_employee || false,
        is_upfit_employee: b.is_upfit_employee || false,
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

  async function handleAdd() {
    if (!newName.trim()) {
      setError("Name is required");
      return;
    }

    // Validate associations
    const validation = validateContactAssociations({
      is_up: newIsUp,
      is_bp: newIsBp,
      is_upfit_employee: newIsUpfit,
      is_third_party_vendor: newIsVendor,
      is_private: newIsPrivate,
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

    const { error: insertError } = await supabase.from("owners").insert({
      name: capitalizeFirst(newName.trim()),
      email: newEmail.trim() || null,
      phone: newPhone.trim() || null,
      is_internal: newIsUp || newIsBp || newIsUpfit,
      is_up_employee: newIsUp,
      is_bp_employee: newIsBp,
      is_upfit_employee: newIsUpfit,
      is_third_party_vendor: newIsVendor,
      is_private: newIsPrivate,
      private_owner_id: newIsPrivate ? user.id : null,
      created_by: user.id,
      created_by_email: profile?.email || user.email || null,
    });

    if (!insertError) {
      setNewName(""); setNewEmail(""); setNewPhone("");
      setNewIsUp(false); setNewIsBp(false); setNewIsUpfit(false); setNewIsVendor(false);
      setNewIsPrivate(false);
      setShowAdd(false);
      await load();
    } else {
      setError(insertError.message);
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-slate-900 rounded-full" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
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
                <button type="button" onClick={() => setNewIsVendor(!newIsVendor)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${newIsVendor ? "border-slate-500 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300" : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-slate-300"}`}>
                  {newIsVendor ? "✓ " : ""}3rd Party Vendor
                </button>
              </div>
            </div>
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
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !newName.trim()} className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-semibold hover:bg-teal-600 disabled:opacity-40 transition">
              {saving ? "Adding..." : "Add Contact"}
            </button>
            <button onClick={() => { setShowAdd(false); setNewName(""); setNewEmail(""); setNewPhone(""); setError(""); }} className="text-sm text-slate-500 hover:text-slate-700 px-3">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Associations</th>
              <th className="px-4 py-3">Created By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {owners.map(o => {
              const unassociated = hasNoAssociations({
                is_up: o.is_up_employee || false,
                is_bp: o.is_bp_employee || false,
                is_upfit_employee: o.is_upfit_employee || false,
                is_third_party_vendor: o.is_third_party_vendor || false,
                is_private: o.is_private || false,
              });

              return (
                <tr key={o.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition ${unassociated ? "flash-red" : ""}`}>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                    {o.is_private && <span className="mr-1.5" title="Private contact">🔒</span>}
                    {o.name}
                    {unassociated && <span className="ml-2 text-xs text-red-600 dark:text-red-400">⚠️ No association</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{o.email || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{o.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {o.is_up_employee && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                          UP
                        </span>
                      )}
                      {o.is_bp_employee && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                          BP
                        </span>
                      )}
                      {o.is_upfit_employee && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                          UPFIT
                        </span>
                      )}
                      {o.is_third_party_vendor && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          Vendor
                        </span>
                      )}
                      {o.is_private && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          {userRole === "admin" && o.private_owner_id
                            ? `🔒 Private (${ownerNames[o.private_owner_id] || "unknown"})`
                            : "🔒 Private"}
                        </span>
                      )}
                      {unassociated && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                          ⚠️ None
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                      {o.created_by_email ? o.created_by_email.split("@")[0] : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

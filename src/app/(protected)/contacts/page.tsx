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
  created_by: string | null;
  created_by_email: string | null;
};

export default function ContactsPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase
      .from("owners")
      .select("id, name, email, phone, is_internal, created_by, created_by_email")
      .order("name");
    setOwners(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("owners").insert({
      name: newName.trim(),
      email: newEmail.trim() || null,
      phone: newPhone.trim() || null,
      is_internal: false,
    });
    if (!error) {
      setNewName(""); setNewEmail(""); setNewPhone(""); setShowAdd(false);
      await load();
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name *" autoFocus
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email (optional)"
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
            <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone (optional)"
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !newName.trim()} className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-semibold hover:bg-teal-600 disabled:opacity-40 transition">
              {saving ? "Adding..." : "Add Contact"}
            </button>
            <button onClick={() => { setShowAdd(false); setNewName(""); setNewEmail(""); setNewPhone(""); }} className="text-sm text-slate-500 hover:text-slate-700 px-3">Cancel</button>
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
              <th className="px-4 py-3">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {owners.map(o => (
              <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{o.name}</td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{o.email || "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{o.phone || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${o.is_internal ? "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"}`}>
                    {o.is_internal ? "Employee" : "External"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

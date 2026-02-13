"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Owner = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  is_up_employee?: boolean;
  is_bp_employee?: boolean;
  is_upfit_employee?: boolean;
  is_bpas_employee?: boolean;
  is_third_party_vendor?: boolean;
};

type Props = {
  profile: { id: string; email: string; full_name: string | null; role: string | null; owner_id: string | null } | null;
  owner: Owner | null;
  owners: { id: string; name: string; email: string | null }[];
  isAdmin: boolean;
};

export function ProfileForm({ profile, owner, owners, isAdmin }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");

  // Team flags
  const [isUp, setIsUp] = useState(owner?.is_up_employee ?? false);
  const [isBp, setIsBp] = useState(owner?.is_bp_employee ?? false);
  const [isUpfit, setIsUpfit] = useState(owner?.is_upfit_employee ?? false);
  const [isBpas, setIsBpas] = useState(owner?.is_bpas_employee ?? false);
  const [isVendor, setIsVendor] = useState(owner?.is_third_party_vendor ?? false);

  // Link to existing owner or create new
  const [selectedOwnerId, setSelectedOwnerId] = useState(profile?.owner_id ?? "");

  const saveTeams = async () => {
    setSaving(true);
    setStatus(null);

    try {
      // If no owner linked, need to create/link one first
      if (!owner && !selectedOwnerId) {
        setStatus({ type: "error", msg: "Please select or create an owner profile first." });
        setSaving(false);
        return;
      }

      const ownerId = owner?.id || selectedOwnerId;

      // Update owner flags
      const res = await fetch("/api/profile/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_id: ownerId,
          is_up_employee: isUp,
          is_bp_employee: isBp,
          is_upfit_employee: isUpfit,
          is_bpas_employee: isBpas,
          is_third_party_vendor: isVendor,
        }),
      });

      if (res.ok) {
        setStatus({ type: "success", msg: "Team assignments updated!" });
        router.refresh();
      } else {
        const data = await res.json();
        setStatus({ type: "error", msg: data.error || "Failed to update" });
      }
    } catch {
      setStatus({ type: "error", msg: "Network error" });
    }
    setSaving(false);
  };

  const linkOwner = async () => {
    if (!selectedOwnerId) return;
    setSaving(true);
    const res = await fetch("/api/profile/link-owner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner_id: selectedOwnerId }),
    });
    if (res.ok) {
      setStatus({ type: "success", msg: "Owner profile linked!" });
      router.refresh();
    } else {
      setStatus({ type: "error", msg: "Failed to link owner" });
    }
    setSaving(false);
  };

  const hasTeam = isUp || isBp || isUpfit || isBpas || isVendor;

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {status && (
        <div className={`px-4 py-3 rounded-lg text-sm ${status.type === "success" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>
          {status.msg}
        </div>
      )}

      {/* Profile info */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Account</h2>
        <div className="text-sm text-slate-600 dark:text-slate-300 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 w-12">Name:</span>
            {editingName ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  autoFocus
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      setSaving(true);
                      const supabase = (await import("@/lib/supabase/client")).createClient();
                      const { error } = await supabase.from("profiles").update({ full_name: fullName.trim() || null }).eq("id", profile!.id);
                      setSaving(false);
                      if (!error) {
                        setEditingName(false);
                        setStatus({ type: "success", msg: "Name updated!" });
                        router.refresh();
                      } else {
                        setStatus({ type: "error", msg: "Failed to update name" });
                      }
                    } else if (e.key === "Escape") {
                      setEditingName(false);
                      setFullName(profile?.full_name ?? "");
                    }
                  }}
                />
                <button
                  onClick={async () => {
                    setSaving(true);
                    const supabase = (await import("@/lib/supabase/client")).createClient();
                    const { error } = await supabase.from("profiles").update({ full_name: fullName.trim() || null }).eq("id", profile!.id);
                    setSaving(false);
                    if (!error) {
                      setEditingName(false);
                      setStatus({ type: "success", msg: "Name updated!" });
                      router.refresh();
                    } else {
                      setStatus({ type: "error", msg: "Failed to update name" });
                    }
                  }}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-teal-500 text-white text-xs font-semibold hover:bg-teal-600 disabled:opacity-50"
                >
                  {saving ? "..." : "Save"}
                </button>
                <button onClick={() => { setEditingName(false); setFullName(profile?.full_name ?? ""); }} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>{profile?.full_name || "Not set"}</span>
                <button onClick={() => setEditingName(true)} className="text-xs text-teal-500 hover:text-teal-600 font-semibold">Edit</button>
              </div>
            )}
          </div>
          <p><span className="text-slate-400">Email:</span> {profile?.email}</p>
          <p><span className="text-slate-400">Role:</span> {profile?.role || "user"}</p>
        </div>
      </div>

      {/* Owner link */}
      {!owner && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-5">
          <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">⚠️ Link Your Owner Profile</h2>
          <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
            You need to link to an owner profile to see tasks and projects. Select your name below:
          </p>
          <div className="flex gap-2">
            <select
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="">Select your owner profile...</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.email ? `(${o.email})` : ""}
                </option>
              ))}
            </select>
            <button
              onClick={linkOwner}
              disabled={saving || !selectedOwnerId}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50"
            >
              Link
            </button>
          </div>
        </div>
      )}

      {/* Team assignment */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Team Membership</h2>
        <p className="text-xs text-slate-400 mb-4">
          Select which teams you belong to. This determines which projects and tasks you can see.
          {!isAdmin && " You can add teams but only an admin can remove them."}
        </p>
        
        {!hasTeam && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-xs text-red-600 dark:text-red-400">
            ⚠️ You must join at least one team to see projects and tasks.
          </div>
        )}

        <div className="space-y-3">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
            <input
              type="checkbox"
              checked={isUp}
              onChange={(e) => { if (isAdmin || e.target.checked) setIsUp(e.target.checked); }}
              disabled={!isAdmin && isUp && owner?.is_up_employee}
              className="rounded border-slate-300 text-blue-600 w-4 h-4"
            />
            <div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">UP</span>
              <span className="text-xs text-slate-400 ml-2">Unplugged Performance</span>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
            <input
              type="checkbox"
              checked={isBp}
              onChange={(e) => { if (isAdmin || e.target.checked) setIsBp(e.target.checked); }}
              disabled={!isAdmin && isBp && owner?.is_bp_employee}
              className="rounded border-slate-300 text-emerald-600 w-4 h-4"
            />
            <div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">BP</span>
              <span className="text-xs text-slate-400 ml-2">Bulletproof Automotive</span>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
            <input
              type="checkbox"
              checked={isUpfit}
              onChange={(e) => { if (isAdmin || e.target.checked) setIsUpfit(e.target.checked); }}
              disabled={!isAdmin && isUpfit && owner?.is_upfit_employee}
              className="rounded border-slate-300 text-purple-600 w-4 h-4"
            />
            <div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">UPFIT</span>
              <span className="text-xs text-slate-400 ml-2">UP.FIT</span>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
            <input
              type="checkbox"
              checked={isBpas}
              onChange={(e) => { if (isAdmin || e.target.checked) setIsBpas(e.target.checked); }}
              disabled={!isAdmin && isBpas && owner?.is_bpas_employee}
              className="rounded border-slate-300 text-violet-600 w-4 h-4"
            />
            <div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">BPAS</span>
              <span className="text-xs text-slate-400 ml-2">Bulletproof Auto Spa</span>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
            <input
              type="checkbox"
              checked={isVendor}
              onChange={(e) => { if (isAdmin || e.target.checked) setIsVendor(e.target.checked); }}
              disabled={!isAdmin && isVendor && owner?.is_third_party_vendor}
              className="rounded border-slate-300 text-orange-600 w-4 h-4"
            />
            <div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">3rd Party Vendor</span>
              <span className="text-xs text-slate-400 ml-2">External vendor/contractor</span>
            </div>
          </label>
        </div>

        <button
          onClick={saveTeams}
          disabled={saving || (!owner && !selectedOwnerId)}
          className="mt-4 w-full rounded-lg bg-teal-500 text-white py-2.5 text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 transition"
        >
          {saving ? "Saving..." : "Save Team Assignments"}
        </button>
      </div>
    </div>
  );
}

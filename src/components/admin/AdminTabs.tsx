"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminTemplates } from "@/components/AdminTemplates";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  owner_id: string | null;
  status: string | null;
  created_at: string;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  is_up?: boolean;
  is_bp?: boolean;
  is_upfit?: boolean;
  visibility?: string;
  created_by?: string;
  deadline?: string | null;
  buffer_days?: number | null;
  customer_name?: string | null;
  created_at: string;
};

type Owner = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_up_employee?: boolean;
  is_bp_employee?: boolean;
  is_upfit_employee?: boolean;
  is_third_party_vendor?: boolean;
  is_private?: boolean;
  private_owner_id?: string | null;
  created_by?: string | null;
  created_by_email: string | null;
  created_at: string;
};

type PendingInvite = {
  id: string;
  email: string;
  role: string;
  invite_token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

type ActivityLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  created_by_email: string | null;
  created_at: string;
  creator: { full_name: string | null; email: string }[] | null;
};

export function AdminTabs({
  activeTab,
  profiles,
  projects,
  owners,
  activityLogs = [],
  pendingInvites = [],
  creatorNames = {},
}: {
  activeTab: string;
  profiles: Profile[];
  projects: Project[];
  owners: Owner[];
  activityLogs?: ActivityLog[];
  pendingInvites?: PendingInvite[];
  creatorNames?: Record<string, string>;
}) {
  const tabs = [
    { key: "users", label: "Users", count: profiles.length, href: "/admin?tab=users" },
    { key: "projects", label: "Projects", count: projects.length, href: "/admin?tab=projects" },
    { key: "owners", label: "Contacts", count: owners.length, href: "/admin?tab=owners" },
    { key: "activity", label: "Activity Log", count: activityLogs.length, href: "/admin?tab=activity" },
    { key: "bugs", label: "Feedback", count: undefined, href: "/admin?tab=bugs" },
    { key: "templates", label: "Templates", count: undefined, href: "/admin?tab=templates" },
  ];

  return (
    <div>
      {/* Tab Navigation */}
      <div className="relative sticky top-0 z-20 mb-4">
        <div className="flex rounded border border-slate-200 bg-white text-xs dark:border-slate-700 dark:bg-slate-800 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`px-4 py-2.5 border-r border-slate-200 dark:border-slate-700 last:border-r-0 whitespace-nowrap min-h-[44px] flex items-center ${
                activeTab === tab.key
                  ? "bg-teal-500 text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              {tab.label} {tab.count !== undefined && <span className={`ml-1 ${activeTab === tab.key ? "text-teal-100" : "text-slate-400"}`}>{tab.count}</span>}
            </Link>
          ))}
        </div>
        {/* Scroll fade hint for mobile */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-slate-800 to-transparent pointer-events-none rounded-r md:hidden" />
      </div>

      {/* Tab Content */}
      <div className="rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {activeTab === "users" && <UsersTab profiles={profiles} owners={owners} pendingInvites={pendingInvites} />}
        {activeTab === "projects" && <ProjectsTab projects={projects} creatorNames={creatorNames} />}
        {activeTab === "owners" && <OwnersTab owners={owners} />}
        {activeTab === "activity" && <ActivityLogTab logs={activityLogs} />}
        {activeTab === "bugs" && <BugsTab />}
        {activeTab === "templates" && <AdminTemplates />}
      </div>
    </div>
  );
}

function UsersTab({ profiles, owners, pendingInvites = [] }: { profiles: Profile[]; owners: Owner[]; pendingInvites?: PendingInvite[] }) {
  const [showInvite, setShowInvite] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [linkToOwner, setLinkToOwner] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createFullName, setCreateFullName] = useState("");
  const [createRole, setCreateRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState<string | null>(null);
  const [inviteMenuOpen, setInviteMenuOpen] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ userId: string; password: string } | null>(null);
  const router = useRouter();

  const updateOwnerLink = async (userId: string, ownerId: string | null) => {
    try {
      const res = await fetch("/api/admin/link-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ownerId }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      console.error("Failed to link owner");
    }
  };

  const inviteUser = async () => {
    if (!inviteEmail) return;
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: inviteEmail, 
          role: inviteRole,
          linkToOwnerId: linkToOwner || null,
        }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setMessage(data.message || `Invite sent to ${inviteEmail}`);
        setInviteEmail("");
        setLinkToOwner("");
        router.refresh();
      } else {
        setMessage(`❌ ${data.error || "Failed to invite user"}`);
      }
    } catch {
      setMessage("❌ Error sending invitation");
    }
    setLoading(false);
  };

  const createUser = async () => {
    if (!createEmail || !createPassword) return;
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createEmail,
          password: createPassword,
          fullName: createFullName || undefined,
          role: createRole,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(`✅ User ${createEmail} created successfully!`);
        setCreateEmail("");
        setCreatePassword("");
        setCreateFullName("");
        setCreateRole("user");
        setShowCreateUser(false);
        router.refresh();
      } else {
        setMessage(data.error || "Failed to create user");
      }
    } catch {
      setMessage("Error creating user");
    }
    setLoading(false);
  };

  const updateRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch("/api/admin/update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      console.error("Failed to update role");
    }
  };

  const startImpersonation = async (userId: string) => {
    setImpersonating(userId);
    try {
      const res = await fetch("/api/admin/impersonate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId }),
      });
      const data = await res.json();
      
      if (res.ok) {
        // Store target info in localStorage for the banner
        localStorage.setItem("impersonation_token", data.token);
        localStorage.setItem("impersonation_target", JSON.stringify(data.targetUser));
        // Cookie is set server-side by the API — hard navigate to force full page reload
        window.location.href = "/";
      } else {
        alert(data.error || "Failed to start impersonation");
      }
    } catch (err) {
      console.error("Failed to impersonate:", err);
      alert("Failed to start impersonation");
    }
    setImpersonating(null);
  };

  const resetPassword = async (userId: string, action: "send_email" | "manual_reset") => {
    setLoading(true);
    setMessage("");
    setResetResult(null);

    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json();

      if (res.ok) {
        if (action === "manual_reset" && data.tempPassword) {
          setResetResult({ userId, password: data.tempPassword });
          setMessage(`Temporary password set: ${data.tempPassword}`);
        } else {
          setMessage(data.message || "Password reset email sent!");
        }
        setUserMenuOpen(null);
      } else {
        setMessage(data.error || "Failed to reset password");
      }
    } catch {
      setMessage("Error resetting password");
    }
    setLoading(false);
  };

  const updateUserStatus = async (userId: string, action: "pause" | "void" | "activate") => {
    const labels = { pause: "Pause", void: "Void", activate: "Activate" };
    const confirmMsg = action === "void"
      ? "⚠️ VOID this user? This will disable login AND hide their task history from non-admin users. Continue?"
      : action === "pause"
      ? "Pause this user? They won't be able to log in until reactivated."
      : "Reactivate this user?";
    if (!confirm(confirmMsg)) { setUserMenuOpen(null); return; }
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/user-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ User ${labels[action].toLowerCase()}d successfully`);
        router.refresh();
      } else {
        setMessage(`❌ ${data.error || "Failed to update user status"}`);
      }
    } catch {
      setMessage("❌ Error updating user status");
    }
    setLoading(false);
    setUserMenuOpen(null);
    setTimeout(() => setMessage(""), 5000);
  };

  const copyInviteLink = async (invite: PendingInvite) => {
    const signupUrl = `https://www.g3tornado.com/signup?email=${encodeURIComponent(invite.email)}&invite=${invite.invite_token}`;
    try {
      await navigator.clipboard.writeText(signupUrl);
      setMessage("Invite link copied to clipboard!");
    } catch {
      // Fallback: show the link in message so user can copy manually
      setMessage(`Invite link: ${signupUrl}`);
    }
    setInviteMenuOpen(null);
    setTimeout(() => setMessage(""), 10000);
  };

  const resendInvite = async (invite: PendingInvite) => {
    setLoading(true);
    setInviteMenuOpen(null);
    setMessage("");
    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: invite.email, role: invite.role, resend: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || `Invite resent to ${invite.email}`);
        router.refresh();
      } else {
        setMessage(`❌ ${data.error || "Failed to resend invite"}`);
      }
    } catch {
      setMessage("❌ Error resending invite");
    }
    setLoading(false);
  };

  const cancelInvite = async (invite: PendingInvite) => {
    if (!confirm(`Cancel invitation for ${invite.email}?`)) return;
    setLoading(true);
    setInviteMenuOpen(null);
    try {
      const res = await fetch("/api/admin/cancel-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId: invite.id }),
      });
      if (res.ok) {
        setMessage(`Invitation for ${invite.email} cancelled.`);
        router.refresh();
      } else {
        const data = await res.json();
        setMessage(data.error || "Failed to cancel invite");
      }
    } catch {
      setMessage("Error cancelling invite");
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">Users</h2>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowCreateUser(!showCreateUser); setShowInvite(false); }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition"
          >
            + Create User
          </button>
          <button
            onClick={() => { setShowInvite(!showInvite); setShowCreateUser(false); }}
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-teal-600 transition"
          >
            + Invite User
          </button>
        </div>
      </div>

      {/* Global status message */}
      {message && !showCreateUser && !showInvite && (
        <div className={`px-4 py-2 text-sm font-medium border-b ${message.includes("❌") || message.includes("Error") || message.includes("Failed") ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800" : message.includes("⚠️") ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"}`}>
          {message}
          <button onClick={() => setMessage("")} className="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {showCreateUser && (
        <div className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs text-slate-500 mb-1">Email *</label>
              <input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                placeholder="user@example.com"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-slate-500 mb-1">Password *</label>
              <input
                type="text"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm font-mono"
                placeholder="Min 8 characters"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-slate-500 mb-1">Full Name</label>
              <input
                type="text"
                value={createFullName}
                onChange={(e) => setCreateFullName(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                placeholder="John Doe"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs text-slate-500 mb-1">Role</label>
              <select
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              onClick={createUser}
              disabled={loading || !createEmail || !createPassword || createPassword.length < 8}
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "..." : "Create"}
            </button>
          </div>
          {message && (
            <p className={`text-xs mt-2 break-all ${message.includes("Error") || message.includes("Failed") ? "text-red-600" : "text-emerald-600"}`}>
              {message}
            </p>
          )}
        </div>
      )}

      {showInvite && (
        <div className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-slate-500 mb-1">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                placeholder="user@example.com"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs text-slate-500 mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="w-40">
              <label className="block text-xs text-slate-500 mb-1">Link to Owner</label>
              <select
                value={linkToOwner}
                onChange={(e) => setLinkToOwner(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
              >
                <option value="">No link</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={inviteUser}
              disabled={loading || !inviteEmail}
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "..." : "Create Invite"}
            </button>
          </div>
          {message && (
            <p className={`text-xs mt-2 break-all ${message.includes("Error") || message.includes("Failed") || message.includes("exists") ? "text-red-600" : "text-emerald-600"}`}>
              {message}
            </p>
          )}
        </div>
      )}

      {resetResult && (
        <div className="border-b border-slate-100 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            ✅ Temporary password for {profiles.find(p => p.id === resetResult.userId)?.email}:
          </p>
          <p className="text-sm font-mono text-emerald-900 dark:text-emerald-100 mt-1 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-700">
            {resetResult.password}
          </p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(resetResult.password);
              setMessage("Password copied to clipboard!");
              setTimeout(() => setMessage(""), 2000);
            }}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 mt-2"
          >
            📋 Copy to clipboard
          </button>
        </div>
      )}

      <div className="overflow-visible">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700 text-left text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              <th className="px-4 py-2 font-semibold">User</th>
              <th className="px-4 py-2 font-semibold w-28">Role</th>
              <th className="px-4 py-2 font-semibold w-40">Linked Owner</th>
              <th className="px-4 py-2 font-semibold w-28">Joined</th>
              <th className="px-4 py-2 font-semibold w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {profiles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No users yet. Users are created when they sign up.
                </td>
              </tr>
            ) : (
              profiles.map((profile) => (
                <tr key={profile.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 ${profile.status === "voided" ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2">
                    <div className={`font-medium ${profile.status === "voided" ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"}`}>
                      {profile.full_name || "—"}
                      {profile.status === "paused" && <span className="ml-2 text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 px-1.5 py-0.5 rounded">⏸️ PAUSED</span>}
                      {profile.status === "voided" && <span className="ml-2 text-xs bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 px-1.5 py-0.5 rounded">🚫 VOIDED</span>}
                    </div>
                    <div className={`${profile.status === "voided" ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-500 dark:text-slate-400"}`}>{profile.email}</div>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={profile.role || "user"}
                      onChange={(e) => updateRole(profile.id, e.target.value)}
                      className={`rounded px-2 py-1 text-xs font-semibold ${
                        profile.role === "admin"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={profile.owner_id || ""}
                      onChange={(e) => updateOwnerLink(profile.id, e.target.value || null)}
                      className={`rounded px-2 py-1 text-xs font-semibold ${
                        profile.owner_id
                          ? "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                      }`}
                    >
                      <option value="">Not linked</option>
                      {owners.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                    {new Date(profile.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 relative">
                    <button
                      onClick={() => setUserMenuOpen(userMenuOpen === profile.id ? null : profile.id)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded px-2 py-1 text-xs"
                    >
                      ⋮
                    </button>
                    {userMenuOpen === profile.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-[9999] min-w-[200px] py-1">
                        <button
                          onClick={() => {
                            startImpersonation(profile.id);
                            setUserMenuOpen(null);
                          }}
                          disabled={impersonating === profile.id}
                          className="w-full text-left px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 disabled:opacity-50"
                        >
                          👤 Login as User
                        </button>
                        <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                        <button
                          onClick={() => resetPassword(profile.id, "send_email")}
                          disabled={loading}
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                        >
                          📧 Send Reset Email
                        </button>
                        <button
                          onClick={() => resetPassword(profile.id, "manual_reset")}
                          disabled={loading}
                          className="w-full text-left px-3 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 disabled:opacity-50"
                        >
                          🔑 Reset Password (Manual)
                        </button>
                        <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                        {(!profile.status || profile.status === "active") && (
                          <>
                            <button
                              onClick={() => updateUserStatus(profile.id, "pause")}
                              disabled={loading}
                              className="w-full text-left px-3 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 disabled:opacity-50"
                            >
                              ⏸️ Pause User
                            </button>
                            <button
                              onClick={() => updateUserStatus(profile.id, "void")}
                              disabled={loading}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
                            >
                              🚫 Void User
                            </button>
                          </>
                        )}
                        {profile.status === "paused" && (
                          <>
                            <button
                              onClick={() => updateUserStatus(profile.id, "activate")}
                              disabled={loading}
                              className="w-full text-left px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 disabled:opacity-50"
                            >
                              ▶️ Reactivate User
                            </button>
                            <button
                              onClick={() => updateUserStatus(profile.id, "void")}
                              disabled={loading}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
                            >
                              🚫 Void User
                            </button>
                          </>
                        )}
                        {profile.status === "voided" && (
                          <button
                            onClick={() => updateUserStatus(profile.id, "activate")}
                            disabled={loading}
                            className="w-full text-left px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 disabled:opacity-50"
                          >
                            ▶️ Reactivate User
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pending Invitations Section */}
      {pendingInvites.length > 0 && (
        <div className="mt-4 border-t border-slate-100 dark:border-slate-700">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              📧 Pending Invitations ({pendingInvites.length})
            </h3>
          </div>
          <div className="overflow-visible">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700 text-left text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  <th className="px-4 py-2 font-semibold">Email</th>
                  <th className="px-4 py-2 font-semibold w-20">Role</th>
                  <th className="px-4 py-2 font-semibold w-24">Status</th>
                  <th className="px-4 py-2 font-semibold w-28">Invited</th>
                  <th className="px-4 py-2 font-semibold w-28">Expires</th>
                  <th className="px-4 py-2 font-semibold w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {pendingInvites.map((invite) => {
                  const isExpired = new Date(invite.expires_at) < new Date();
                  const isAccepted = !!invite.accepted_at;
                  const status = isAccepted ? "accepted" : isExpired ? "expired" : "pending";
                  
                  return (
                    <tr key={invite.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-2 text-slate-900 dark:text-white font-medium">
                        {invite.email}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          invite.role === "admin" 
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                        }`}>
                          {invite.role}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          status === "accepted" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" :
                          status === "expired" ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" :
                          "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                        }`}>
                          {status === "accepted" ? "✅ Accepted" : status === "expired" ? "⏰ Expired" : "⏳ Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                        {new Date(invite.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                        {new Date(invite.expires_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 relative">
                        <button
                          onClick={() => setInviteMenuOpen(inviteMenuOpen === invite.id ? null : invite.id)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded px-2 py-1 text-xs"
                        >
                          ⋮
                        </button>
                        {inviteMenuOpen === invite.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-[9999] min-w-[200px] py-1">
                            <button
                              onClick={() => copyInviteLink(invite)}
                              className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              📋 Copy Invite Link
                            </button>
                            {!isAccepted && (
                              <button
                                onClick={() => resendInvite(invite)}
                                disabled={loading}
                                className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50"
                              >
                                🔄 Resend Invitation
                              </button>
                            )}
                            {!isAccepted && (
                              <>
                                <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                                <button
                                  onClick={() => cancelInvite(invite)}
                                  disabled={loading}
                                  className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
                                >
                                  ❌ Cancel Invitation
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectsTab({ projects, creatorNames = {} }: { projects: Project[]; creatorNames?: Record<string, string> }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isUp, setIsUp] = useState(false);
  const [isBp, setIsBp] = useState(false);
  const [isUpfit, setIsUpfit] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const resetForm = () => {
    setName(""); setDescription(""); setIsUp(false); setIsBp(false); setIsUpfit(false);
  };

  const saveProject = async (projectId?: string) => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/projects", {
        method: projectId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, name, description, is_up: isUp, is_bp: isBp, is_upfit: isUpfit }),
      });
      if (res.ok) { resetForm(); setShowAdd(false); setEditingId(null); router.refresh(); }
    } catch { console.error("Failed to save project"); }
    setLoading(false);
  };

  const toggleProjectFlag = async (projectId: string, field: string, value: boolean | string | number | null) => {
    try {
      const res = await fetch("/api/admin/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, [field]: value }),
      });
      if (res.ok) router.refresh();
    } catch { console.error("Failed to update"); }
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm("Delete this project? Tasks will become unassigned.")) return;
    try { await fetch(`/api/admin/projects?id=${projectId}`, { method: "DELETE" }); router.refresh(); }
    catch { console.error("Failed to delete project"); }
  };

  const startEdit = (project: Project) => {
    setEditingId(project.id);
    setName(project.name);
    setDescription(project.description || "");
    setIsUp(project.is_up || false);
    setIsBp(project.is_bp || false);
    setIsUpfit(project.is_upfit || false);
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">Projects</h2>
        <button
          onClick={() => { setShowAdd(!showAdd); setEditingId(null); resetForm(); }}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-teal-600 transition"
        >
          + Add Project
        </button>
      </div>

      {showAdd && (
        <div className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3">
          <div className="space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Project name" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Description</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Brief description" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-2">Business Unit(s):</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={isUp} onChange={(e) => setIsUp(e.target.checked)} className="rounded border-slate-300 text-blue-600" />
                  <span className="text-slate-700 dark:text-slate-300">UP</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={isBp} onChange={(e) => setIsBp(e.target.checked)} className="rounded border-slate-300 text-emerald-600" />
                  <span className="text-slate-700 dark:text-slate-300">BP</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={isUpfit} onChange={(e) => setIsUpfit(e.target.checked)} className="rounded border-slate-300 text-purple-600" />
                  <span className="text-slate-700 dark:text-slate-300">UPFIT</span>
                </label>
              </div>
            </div>
            <button onClick={() => saveProject()} disabled={loading || !name.trim()} className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {loading ? "Saving..." : "Add Project"}
            </button>
          </div>
        </div>
      )}

      {editingId && (
        <div className="border-b border-slate-100 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/10 px-4 py-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">✏️ Editing: {name}</p>
          <div className="space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Description</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-2">Business Unit(s):</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={isUp} onChange={(e) => setIsUp(e.target.checked)} className="rounded border-slate-300 text-blue-600" />
                  <span className="text-slate-700 dark:text-slate-300">UP</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={isBp} onChange={(e) => setIsBp(e.target.checked)} className="rounded border-slate-300 text-emerald-600" />
                  <span className="text-slate-700 dark:text-slate-300">BP</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={isUpfit} onChange={(e) => setIsUpfit(e.target.checked)} className="rounded border-slate-300 text-purple-600" />
                  <span className="text-slate-700 dark:text-slate-300">UPFIT</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => saveProject(editingId)} disabled={loading || !name.trim()} className="rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">{loading ? "..." : "Save"}</button>
              <button onClick={() => { setEditingId(null); resetForm(); }} className="rounded bg-slate-200 dark:bg-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-visible">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700 text-left text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              <th className="px-4 py-2 font-semibold">Project</th>
              <th className="px-3 py-2 font-semibold text-center w-16">Type</th>
              <th className="px-3 py-2 font-semibold text-center w-12">UP</th>
              <th className="px-3 py-2 font-semibold text-center w-12">BP</th>
              <th className="px-3 py-2 font-semibold text-center w-16">UPFIT</th>
              <th className="px-4 py-2 font-semibold">Description</th>
              <th className="px-3 py-2 font-semibold w-28">Deadline</th>
              <th className="px-3 py-2 font-semibold w-16">Buffer</th>
              <th className="px-3 py-2 font-semibold">Customer</th>
              <th className="px-4 py-2 font-semibold w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {projects.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">No projects yet.</td></tr>
            ) : (
              projects.map((project) => (
                <tr key={project.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-900 dark:text-white">{project.name}</div>
                    {(project as Project & { created_by?: string }).created_by && creatorNames[(project as Project & { created_by?: string }).created_by!] && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">by {creatorNames[(project as Project & { created_by?: string }).created_by!]}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => toggleProjectFlag(project.id, "visibility", project.visibility === "personal" ? "shared" : "personal")}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${project.visibility === "personal" ? "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400" : "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300"}`}
                    >
                      {project.visibility === "personal" ? "🔒 Personal" : "👥 Shared"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={project.is_up || false} onChange={(e) => toggleProjectFlag(project.id, "is_up", e.target.checked)} className="rounded border-slate-300 text-blue-600 cursor-pointer" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={project.is_bp || false} onChange={(e) => toggleProjectFlag(project.id, "is_bp", e.target.checked)} className="rounded border-slate-300 text-emerald-600 cursor-pointer" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={project.is_upfit || false} onChange={(e) => toggleProjectFlag(project.id, "is_upfit", e.target.checked)} className="rounded border-slate-300 text-purple-600 cursor-pointer" />
                  </td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{project.description || "—"}</td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={project.deadline || ""}
                      onChange={(e) => toggleProjectFlag(project.id, "deadline", e.target.value || null)}
                      className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-1 py-0.5 text-[10px] text-slate-700 dark:text-slate-300"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      value={project.buffer_days ?? 7}
                      onChange={(e) => toggleProjectFlag(project.id, "buffer_days", parseInt(e.target.value) || 7)}
                      className="w-14 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-1 py-0.5 text-[10px] text-center text-slate-700 dark:text-slate-300"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={project.customer_name || ""}
                      onChange={(e) => toggleProjectFlag(project.id, "customer_name", e.target.value || null)}
                      placeholder="Customer..."
                      className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-1 py-0.5 text-[10px] text-slate-700 dark:text-slate-300"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => startEdit(project)} className="text-slate-400 hover:text-slate-600 mr-2">Edit</button>
                    <button onClick={() => deleteProject(project.id)} className="text-red-400 hover:text-red-600">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Owner badges component for displaying employee/vendor status
function OwnerBadges({ owner }: { owner: Owner }) {
  return (
    <div className="flex flex-wrap gap-1">
      {owner.is_up_employee && (
        <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
          UP
        </span>
      )}
      {owner.is_bp_employee && (
        <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
          BP
        </span>
      )}
      {owner.is_upfit_employee && (
        <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
          UF
        </span>
      )}
      {owner.is_third_party_vendor && (
        <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
          Vendor
        </span>
      )}
    </div>
  );
}

// Contact icons for email and phone
function ContactIcons({ owner }: { owner: Owner }) {
  return (
    <span className="ml-2 text-slate-400">
      {owner.email && <span title={owner.email}>📧</span>}
      {owner.phone && <span title={owner.phone} className="ml-1">📞</span>}
    </span>
  );
}

function EditableCell({ value, onSave, placeholder, type = "text" }: { value: string; onSave: (v: string) => void; placeholder?: string; type?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onSave(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { if (draft !== value) onSave(draft); setEditing(false); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        autoFocus
        className="w-full rounded border border-teal-400 bg-white dark:bg-slate-800 px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-teal-400"
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      className="cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded px-1.5 py-0.5 -mx-1.5 block min-h-[20px]"
      title="Click to edit"
    >
      {value || <span className="text-slate-300 dark:text-slate-600 italic">{placeholder || "—"}</span>}
    </span>
  );
}

function OwnersTab({ owners }: { owners: Owner[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isUpEmployee, setIsUpEmployee] = useState(false);
  const [isBpEmployee, setIsBpEmployee] = useState(false);
  const [isUpfitEmployee, setIsUpfitEmployee] = useState(false);
  const [isThirdPartyVendor, setIsThirdPartyVendor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ownerMenuOpen, setOwnerMenuOpen] = useState<string | null>(null);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const router = useRouter();

  const resetForm = () => {
    setName(""); setEmail(""); setPhone("");
    setIsUpEmployee(false); setIsBpEmployee(false); setIsUpfitEmployee(false); setIsThirdPartyVendor(false);
    setError("");
  };

  // Vendors CAN have company associations (and must have at least one)
  const handleVendorChange = (checked: boolean) => {
    setIsThirdPartyVendor(checked);
  };

  const handleEmployeeChange = (setter: (v: boolean) => void, checked: boolean) => {
    setter(checked);
  };

  const saveOwner = async () => {
    if (!name.trim()) return;
    // Vendor must have at least one company
    if (isThirdPartyVendor && !isUpEmployee && !isBpEmployee && !isUpfitEmployee) {
      setError("Vendors must be associated with at least one company (UP, BP, or UPFIT)");
      return;
    }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email || null, phone: phone || null, is_up_employee: isUpEmployee, is_bp_employee: isBpEmployee, is_upfit_employee: isUpfitEmployee, is_third_party_vendor: isThirdPartyVendor }),
      });
      const data = await res.json();
      if (res.ok) { resetForm(); setShowAdd(false); router.refresh(); }
      else setError(data.error || "Failed to save owner");
    } catch { setError("Failed to save owner"); }
    setLoading(false);
  };

  const updateOwnerField = async (ownerId: string, field: string, value: string) => {
    try {
      // Get owner current data for the PUT
      const owner = owners.find(o => o.id === ownerId);
      if (!owner) return;
      const res = await fetch("/api/admin/owners", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ownerId, name: field === "name" ? value : owner.name, email: field === "email" ? (value || null) : owner.email, phone: field === "phone" ? (value || null) : owner.phone }),
      });
      if (res.ok) router.refresh();
      else { const data = await res.json(); alert(data.error || "Failed to update"); }
    } catch { alert("Failed to update"); }
  };

  const saveEditingOwner = async () => {
    if (!editingOwner || !editName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/owners", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingOwner.id, name: editName, email: editEmail || null, phone: editPhone || null }),
      });
      if (res.ok) { setEditingOwner(null); router.refresh(); }
      else { const data = await res.json(); alert(data.error || "Failed to update"); }
    } catch { alert("Failed to update"); }
    setLoading(false);
  };

  const toggleFlag = async (ownerId: string, field: string, value: boolean) => {
    try {
      const res = await fetch("/api/admin/owners/toggle-flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId, field, value }),
      });
      if (res.ok) router.refresh();
      else { const data = await res.json(); alert(data.error || "Failed to update"); }
    } catch { alert("Failed to update flag"); }
  };

  const deleteOwner = async (ownerId: string) => {
    if (!confirm("Delete this owner? They will be removed from all tasks.")) return;
    setOwnerMenuOpen(null);
    try { await fetch(`/api/admin/owners?id=${ownerId}`, { method: "DELETE" }); router.refresh(); }
    catch { console.error("Failed to delete owner"); }
  };

  const startEdit = (owner: Owner) => {
    setEditingOwner(owner);
    setEditName(owner.name);
    setEditEmail(owner.email || "");
    setEditPhone(owner.phone || "");
    setOwnerMenuOpen(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">Contacts</h2>
        <button
          onClick={() => { setShowAdd(!showAdd); resetForm(); }}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-teal-600 transition"
        >
          + Add Owner
        </button>
      </div>

      {showAdd && (
        <div className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Owner Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full max-w-md rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="Full name or company name" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-2">Company Association{isThirdPartyVendor ? " (required for vendors)" : ""}:</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={isUpEmployee} onChange={(e) => handleEmployeeChange(setIsUpEmployee, e.target.checked)} className="rounded border-slate-300 text-blue-600" />
                  <span className="text-slate-700 dark:text-slate-300">UP</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={isBpEmployee} onChange={(e) => handleEmployeeChange(setIsBpEmployee, e.target.checked)} className="rounded border-slate-300 text-emerald-600" />
                  <span className="text-slate-700 dark:text-slate-300">BP</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={isUpfitEmployee} onChange={(e) => handleEmployeeChange(setIsUpfitEmployee, e.target.checked)} className="rounded border-slate-300 text-purple-600" />
                  <span className="text-slate-700 dark:text-slate-300">UPFIT</span>
                </label>
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={isThirdPartyVendor} onChange={(e) => handleVendorChange(e.target.checked)} className="rounded border-slate-300 text-orange-600" />
              <span className="text-slate-700 dark:text-slate-300">3rd Party Vendor</span>
            </label>
            {isThirdPartyVendor && !isUpEmployee && !isBpEmployee && !isUpfitEmployee && (
              <p className="text-xs text-red-600 dark:text-red-400">⚠️ Vendors must have at least one company association</p>
            )}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-slate-500 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="owner@example.com" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-slate-500 mb-1">Phone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" placeholder="(555) 123-4567" />
              </div>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button onClick={() => saveOwner()} disabled={loading || !name.trim()} className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {loading ? "Saving..." : "Add Owner"}
            </button>
          </div>
        </div>
      )}

      {/* Edit Owner Modal */}
      {editingOwner && (
        <div className="border-b border-slate-100 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/10 px-4 py-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">✏️ Editing: {editingOwner.name}</p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-slate-500 mb-1">Name *</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-slate-500 mb-1">Email</label>
              <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-slate-500 mb-1">Phone</label>
              <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm" />
            </div>
            <button onClick={saveEditingOwner} disabled={loading || !editName.trim()} className="rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
              {loading ? "..." : "Save"}
            </button>
            <button onClick={() => setEditingOwner(null)} className="rounded bg-slate-200 dark:bg-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-visible">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700 text-left text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold text-center w-12">UP</th>
              <th className="px-3 py-2 font-semibold text-center w-12">BP</th>
              <th className="px-3 py-2 font-semibold text-center w-16">UPFIT</th>
              <th className="px-3 py-2 font-semibold text-center w-16">Vendor</th>
              <th className="px-3 py-2 font-semibold text-center w-16">Private</th>
              <th className="px-4 py-2 font-semibold">Email</th>
              <th className="px-4 py-2 font-semibold">Phone</th>
              <th className="px-4 py-2 font-semibold w-28">Created By</th>
              <th className="px-4 py-2 font-semibold w-16">⋮</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {owners.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">No owners yet.</td>
              </tr>
            ) : (
              owners.map((owner) => {
                const isVendor = owner.is_third_party_vendor;
                const hasCompany = owner.is_up_employee || owner.is_bp_employee || owner.is_upfit_employee;
                const vendorWarning = isVendor && !hasCompany;
                
                return (
                  <tr key={owner.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 ${vendorWarning ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                      <EditableCell value={owner.name} onSave={(v) => updateOwnerField(owner.id, "name", v)} placeholder="Name" />
                      {vendorWarning && (
                        <div className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">
                          ⚠️ Vendor needs company
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={owner.is_up_employee || false} onChange={(e) => toggleFlag(owner.id, "is_up_employee", e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={owner.is_bp_employee || false} onChange={(e) => toggleFlag(owner.id, "is_bp_employee", e.target.checked)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={owner.is_upfit_employee || false} onChange={(e) => toggleFlag(owner.id, "is_upfit_employee", e.target.checked)} className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={owner.is_third_party_vendor || false} onChange={(e) => toggleFlag(owner.id, "is_third_party_vendor", e.target.checked)} className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={owner.is_private || false} onChange={(e) => toggleFlag(owner.id, "is_private", e.target.checked)} className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer" />
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      <EditableCell value={owner.email || ""} onSave={(v) => updateOwnerField(owner.id, "email", v)} placeholder="Add email" type="email" />
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      <EditableCell value={owner.phone || ""} onSave={(v) => updateOwnerField(owner.id, "phone", v)} placeholder="Add phone" type="tel" />
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                        {owner.created_by_email ? owner.created_by_email.split("@")[0] : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2 relative">
                      <button
                        onClick={() => setOwnerMenuOpen(ownerMenuOpen === owner.id ? null : owner.id)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded px-2 py-1 text-xs"
                      >
                        ⋮
                      </button>
                      {ownerMenuOpen === owner.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-[9999] min-w-[160px] py-1">
                          <button
                            onClick={() => startEdit(owner)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            ✏️ Edit All Fields
                          </button>
                          <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                          <button
                            onClick={() => deleteOwner(owner.id)}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                          >
                            🗑️ Delete Owner
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActivityLogTab({ logs }: { logs: ActivityLog[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  const deleteEntity = async (log: ActivityLog) => {
    if (log.action === "deleted") return; // Can't delete already deleted
    if (!confirm(`Delete ${log.entity_type} "${log.entity_name}"?`)) return;
    
    setDeleting(log.id);
    try {
      const res = await fetch("/api/admin/activity-log", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: log.entity_type,
          entityId: log.entity_id,
          entityName: log.entity_name,
        }),
      });
      
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete");
      }
    } catch {
      alert("Failed to delete");
    }
    setDeleting(null);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "created":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300";
      case "deleted":
        return "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300";
      case "updated":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300";
      case "invited":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300";
      case "impersonated":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
      case "migrated_from_vendor":
        return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
    }
  };

  const getEntityBadge = (type: string) => {
    switch (type) {
      case "owner":
        return "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300";
      case "vendor":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300";
      case "user":
        return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300";
      case "project":
        return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">Activity Log</h2>
        <span className="text-xs text-slate-500">{logs.length} entries</span>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-700 text-left text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            <th className="px-4 py-2 font-semibold w-24">Action</th>
            <th className="px-4 py-2 font-semibold w-20">Type</th>
            <th className="px-4 py-2 font-semibold">Name</th>
            <th className="px-4 py-2 font-semibold">Created By</th>
            <th className="px-4 py-2 font-semibold w-32">Date</th>
            <th className="px-4 py-2 font-semibold w-20">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {logs.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                No activity recorded yet.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td className="px-4 py-2">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${getActionBadge(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${getEntityBadge(log.entity_type)}`}>
                    {log.entity_type}
                  </span>
                </td>
                <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                  {log.entity_name || "—"}
                </td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                  {log.creator?.[0]?.full_name || log.created_by_email || "System"}
                </td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  {log.action !== "deleted" && ["owner", "project"].includes(log.entity_type) && (
                    <button
                      onClick={() => deleteEntity(log)}
                      disabled={deleting === log.id}
                      className="text-red-400 hover:text-red-600 disabled:opacity-50"
                    >
                      {deleting === log.id ? "..." : "Delete"}
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

type BugReportItem = {
  id: string;
  description: string;
  screenshot_url: string | null;
  reported_by_email: string | null;
  status: string;
  type: string;
  resolution: string | null;
  fixed_at: string | null;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  investigating: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  fixed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  escalated: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  duplicate: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
  reviewing: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  dismissed: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
};

function BugsTab() {
  const [items, setItems] = useState<BugReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "bug" | "feature_request">("all");

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/bugs");
      if (res.ok) setItems(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/bugs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems(items.map((b) => (b.id === id ? updated : b)));
      }
    } catch { /* ignore */ }
    setUpdatingId(null);
  };

  const filtered = filter === "all" ? items : items.filter((i) => (i.type || "bug") === filter);
  const bugCount = items.filter((i) => (i.type || "bug") === "bug").length;
  const featureCount = items.filter((i) => i.type === "feature_request").length;

  if (loading) {
    return <div className="px-4 py-8 text-center text-slate-400 text-sm">Loading feedback...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">💬 Feedback ({items.length})</h2>
        <div className="flex gap-1">
          {(["all", "bug", "feature_request"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded text-[10px] font-semibold transition ${
                filter === f
                  ? f === "feature_request"
                    ? "bg-indigo-500 text-white"
                    : f === "bug"
                    ? "bg-teal-500 text-white"
                    : "bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-800"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              {f === "all" ? `All (${items.length})` : f === "bug" ? `🐛 Bugs (${bugCount})` : `💡 Features (${featureCount})`}
            </button>
          ))}
        </div>
      </div>

      {expandedImage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70" onClick={() => setExpandedImage(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={expandedImage} alt="Screenshot" className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl" />
        </div>
      )}

      <div className="overflow-visible">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700 text-left text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              <th className="px-4 py-2 font-semibold w-12">Type</th>
              <th className="px-4 py-2 font-semibold">Description</th>
              <th className="px-4 py-2 font-semibold w-16">Image</th>
              <th className="px-4 py-2 font-semibold w-40">Reporter</th>
              <th className="px-4 py-2 font-semibold w-32">Status</th>
              <th className="px-4 py-2 font-semibold w-24">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No feedback yet. 🎉</td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isFeature = item.type === "feature_request";
                const statusOptions = isFeature
                  ? [
                      { value: "pending", label: "Pending" },
                      { value: "reviewing", label: "Reviewing" },
                      { value: "approved", label: "Approved" },
                      { value: "dismissed", label: "Dismissed" },
                    ]
                  : [
                      { value: "pending", label: "Pending" },
                      { value: "investigating", label: "Investigating" },
                      { value: "fixed", label: "Fixed" },
                      { value: "escalated", label: "Escalated" },
                      { value: "duplicate", label: "Duplicate" },
                    ];

                return (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          isFeature
                            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                            : "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300"
                        }`}
                      >
                        {isFeature ? "💡" : "🐛"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-900 dark:text-white max-w-xs">
                      <div className="line-clamp-3">{item.description}</div>
                      {item.resolution && (
                        <div className="mt-1 text-[10px] text-slate-400 italic">Resolution: {item.resolution}</div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {item.screenshot_url ? (
                        <button onClick={() => setExpandedImage(item.screenshot_url)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.screenshot_url} alt="" className="w-10 h-10 rounded object-cover border border-slate-200 dark:border-slate-600 hover:opacity-80 transition" />
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{item.reported_by_email || "—"}</td>
                    <td className="px-4 py-2">
                      <select
                        value={item.status}
                        onChange={(e) => updateStatus(item.id, e.target.value)}
                        disabled={updatingId === item.id}
                        className={`rounded px-2 py-1 text-xs font-semibold ${STATUS_COLORS[item.status] || STATUS_COLORS.pending}`}
                      >
                        {statusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

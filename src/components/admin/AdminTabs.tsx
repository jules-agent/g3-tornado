"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  owner_id: string | null;
  created_at: string;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type Owner = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_by_email: string | null;
  created_at: string;
};

type Vendor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
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
  vendors = [],
  activityLogs = [],
}: {
  activeTab: string;
  profiles: Profile[];
  projects: Project[];
  owners: Owner[];
  vendors?: Vendor[];
  activityLogs?: ActivityLog[];
}) {
  const tabs = [
    { key: "users", label: "Users", count: profiles.length, href: "/admin?tab=users" },
    { key: "projects", label: "Projects", count: projects.length, href: "/admin?tab=projects" },
    { key: "owners", label: "Owners", count: owners.length, href: "/admin?tab=owners" },
    { key: "vendors", label: "Vendors", count: vendors.length, href: "/admin?tab=vendors" },
    { key: "activity", label: "Activity Log", count: activityLogs.length, href: "/admin?tab=activity" },
  ];

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex rounded border border-slate-200 bg-white text-xs mb-4 dark:border-slate-700 dark:bg-slate-800 overflow-x-auto">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`px-4 py-2 border-r border-slate-200 dark:border-slate-700 last:border-r-0 whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-teal-500 text-white"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            {tab.label} <span className={activeTab === tab.key ? "text-teal-100" : "text-slate-400"}>{tab.count}</span>
          </Link>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {activeTab === "users" && <UsersTab profiles={profiles} owners={owners} />}
        {activeTab === "projects" && <ProjectsTab projects={projects} />}
        {activeTab === "owners" && <OwnersTab owners={owners} />}
        {activeTab === "vendors" && <VendorsTab vendors={vendors} />}
        {activeTab === "activity" && <ActivityLogTab logs={activityLogs} />}
      </div>
    </div>
  );
}

function UsersTab({ profiles, owners }: { profiles: Profile[]; owners: Owner[] }) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [linkToOwner, setLinkToOwner] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [impersonating, setImpersonating] = useState<string | null>(null);
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
        setMessage(`Invite created! Share this link: ${data.signupUrl}`);
        setInviteEmail("");
        setLinkToOwner("");
        router.refresh();
      } else {
        setMessage(data.error || "Failed to invite user");
      }
    } catch {
      setMessage("Error sending invitation");
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
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId }),
      });
      const data = await res.json();
      
      if (res.ok) {
        // Store impersonation token and redirect
        localStorage.setItem("impersonation_token", data.token);
        localStorage.setItem("impersonation_target", JSON.stringify(data.targetUser));
        // Open in new tab with impersonation active
        window.open(`/?impersonate=${data.token}`, "_blank");
      } else {
        alert(data.error || "Failed to start impersonation");
      }
    } catch (err) {
      console.error("Failed to impersonate:", err);
      alert("Failed to start impersonation");
    }
    setImpersonating(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">Users</h2>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-teal-600 transition"
        >
          + Invite User
        </button>
      </div>

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

      <div className="overflow-x-auto">
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
                <tr key={profile.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {profile.full_name || "—"}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">{profile.email}</div>
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
                  <td className="px-4 py-2">
                    <button
                      onClick={() => startImpersonation(profile.id)}
                      disabled={impersonating === profile.id}
                      className="rounded bg-purple-100 dark:bg-purple-900/50 px-2 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50 disabled:opacity-50"
                      title="Login as this user"
                    >
                      {impersonating === profile.id ? "..." : "👤 Login as"}
                    </button>
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

function ProjectsTab({ projects }: { projects: Project[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const saveProject = async (projectId?: string) => {
    if (!name.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/admin/projects", {
        method: projectId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, name, description }),
      });
      
      if (res.ok) {
        setName("");
        setDescription("");
        setShowAdd(false);
        setEditingId(null);
        router.refresh();
      }
    } catch {
      console.error("Failed to save project");
    }
    setLoading(false);
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm("Delete this project? Tasks will become unassigned.")) return;
    
    try {
      await fetch(`/api/admin/projects?id=${projectId}`, { method: "DELETE" });
      router.refresh();
    } catch {
      console.error("Failed to delete project");
    }
  };

  const startEdit = (project: Project) => {
    setEditingId(project.id);
    setName(project.name);
    setDescription(project.description || "");
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">Projects</h2>
        <button
          onClick={() => { setShowAdd(!showAdd); setEditingId(null); setName(""); setDescription(""); }}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-teal-600 transition"
        >
          + Add Project
        </button>
      </div>

      {showAdd && (
        <div className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                placeholder="Project name"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                placeholder="Brief description"
              />
            </div>
            <button
              onClick={() => saveProject()}
              disabled={loading || !name.trim()}
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "..." : "Add"}
            </button>
          </div>
        </div>
      )}

      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-700 text-left text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            <th className="px-4 py-2 font-semibold">Project</th>
            <th className="px-4 py-2 font-semibold">Description</th>
            <th className="px-4 py-2 font-semibold w-28">Created</th>
            <th className="px-4 py-2 font-semibold w-20">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {projects.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                No projects yet. Add your first project above.
              </td>
            </tr>
          ) : (
            projects.map((project) => (
              <tr key={project.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                {editingId === project.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {new Date(project.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => saveProject(project.id)}
                        className="text-emerald-600 hover:text-emerald-800 mr-2"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                      {project.name}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {project.description || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {new Date(project.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => startEdit(project)}
                        className="text-slate-400 hover:text-slate-600 mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteProject(project.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function OwnersTab({ owners }: { owners: Owner[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const saveOwner = async (ownerId?: string) => {
    if (!name.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/admin/owners", {
        method: ownerId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ownerId, name, email: email || null, phone: phone || null }),
      });
      
      if (res.ok) {
        setName("");
        setEmail("");
        setPhone("");
        setShowAdd(false);
        setEditingId(null);
        router.refresh();
      }
    } catch {
      console.error("Failed to save owner");
    }
    setLoading(false);
  };

  const deleteOwner = async (ownerId: string) => {
    if (!confirm("Delete this owner? They will be removed from all tasks.")) return;
    
    try {
      await fetch(`/api/admin/owners?id=${ownerId}`, { method: "DELETE" });
      router.refresh();
    } catch {
      console.error("Failed to delete owner");
    }
  };

  const startEdit = (owner: Owner) => {
    setEditingId(owner.id);
    setName(owner.name);
    setEmail(owner.email || "");
    setPhone(owner.phone || "");
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">Owners</h2>
        <button
          onClick={() => { setShowAdd(!showAdd); setEditingId(null); setName(""); setEmail(""); setPhone(""); }}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-teal-600 transition"
        >
          + Add Owner
        </button>
      </div>

      {showAdd && (
        <div className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                placeholder="Owner name"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                placeholder="owner@example.com"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Phone (optional)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                placeholder="(555) 123-4567"
              />
            </div>
            <button
              onClick={() => saveOwner()}
              disabled={loading || !name.trim()}
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "..." : "Add"}
            </button>
          </div>
        </div>
      )}

      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-700 text-left text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            <th className="px-4 py-2 font-semibold">Name</th>
            <th className="px-4 py-2 font-semibold">Email</th>
            <th className="px-4 py-2 font-semibold">Phone</th>
            <th className="px-4 py-2 font-semibold">Created By</th>
            <th className="px-4 py-2 font-semibold w-28">Created</th>
            <th className="px-4 py-2 font-semibold w-20">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {owners.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                No owners yet. Add your first owner above.
              </td>
            </tr>
          ) : (
            owners.map((owner) => (
              <tr key={owner.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                {editingId === owner.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                        placeholder="Optional"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                        placeholder="Optional"
                      />
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {owner.created_by_email || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {new Date(owner.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => saveOwner(owner.id)}
                        className="text-emerald-600 hover:text-emerald-800 mr-2"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                      {owner.name}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {owner.email || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {owner.phone || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {owner.created_by_email || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {new Date(owner.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => startEdit(owner)}
                        className="text-slate-400 hover:text-slate-600 mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteOwner(owner.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function VendorsTab({ vendors }: { vendors: Vendor[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const saveVendor = async (vendorId?: string) => {
    if (!name.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/vendors", {
        method: vendorId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: vendorId, name, email, phone, company }),
      });
      
      if (res.ok) {
        setName("");
        setEmail("");
        setPhone("");
        setCompany("");
        setShowAdd(false);
        setEditingId(null);
        router.refresh();
      }
    } catch {
      console.error("Failed to save vendor");
    }
    setLoading(false);
  };

  const deleteVendor = async (vendorId: string) => {
    if (!confirm("Delete this vendor?")) return;
    
    try {
      await fetch(`/api/vendors?id=${vendorId}`, { method: "DELETE" });
      router.refresh();
    } catch {
      console.error("Failed to delete vendor");
    }
  };

  const startEdit = (vendor: Vendor) => {
    setEditingId(vendor.id);
    setName(vendor.name);
    setEmail(vendor.email || "");
    setPhone(vendor.phone || "");
    setCompany(vendor.company || "");
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">Vendors</h2>
        <button
          onClick={() => { setShowAdd(!showAdd); setEditingId(null); setName(""); setEmail(""); setPhone(""); setCompany(""); }}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-teal-600 transition"
        >
          + Add Vendor
        </button>
      </div>

      {showAdd && (
        <div className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-slate-500 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                placeholder="Vendor name"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-slate-500 mb-1">Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                placeholder="Company name"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-slate-500 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                placeholder="vendor@example.com"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-slate-500 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                placeholder="(555) 123-4567"
              />
            </div>
            <button
              onClick={() => saveVendor()}
              disabled={loading || !name.trim()}
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "..." : "Add"}
            </button>
          </div>
        </div>
      )}

      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-700 text-left text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            <th className="px-4 py-2 font-semibold">Name</th>
            <th className="px-4 py-2 font-semibold">Company</th>
            <th className="px-4 py-2 font-semibold">Email</th>
            <th className="px-4 py-2 font-semibold">Phone</th>
            <th className="px-4 py-2 font-semibold w-28">Created</th>
            <th className="px-4 py-2 font-semibold w-20">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {vendors.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                No vendors yet. Add your first vendor above.
              </td>
            </tr>
          ) : (
            vendors.map((vendor) => (
              <tr key={vendor.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                {editingId === vendor.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {new Date(vendor.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => saveVendor(vendor.id)}
                        className="text-emerald-600 hover:text-emerald-800 mr-2"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                      {vendor.name}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {vendor.company || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {vendor.email || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {vendor.phone || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {new Date(vendor.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => startEdit(vendor)}
                        className="text-slate-400 hover:text-slate-600 mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteVendor(vendor.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
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
                  {log.action !== "deleted" && ["owner", "vendor", "project"].includes(log.entity_type) && (
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

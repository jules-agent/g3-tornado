"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
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
  created_at: string;
};

export function AdminTabs({
  activeTab,
  profiles,
  projects,
  owners,
}: {
  activeTab: string;
  profiles: Profile[];
  projects: Project[];
  owners: Owner[];
}) {
  const router = useRouter();
  const tabs = [
    { key: "users", label: "Users", count: profiles.length },
    { key: "projects", label: "Projects", count: projects.length },
    { key: "owners", label: "Owners", count: owners.length },
  ];

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex rounded border border-slate-200 bg-white text-xs mb-4">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin?tab=${tab.key}`}
            className={`px-4 py-2 border-r border-slate-200 last:border-r-0 ${
              activeTab === tab.key
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.label} <span className="text-slate-400 ml-1">{tab.count}</span>
          </Link>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded border border-slate-200 bg-white">
        {activeTab === "users" && <UsersTab profiles={profiles} />}
        {activeTab === "projects" && <ProjectsTab projects={projects} />}
        {activeTab === "owners" && <OwnersTab owners={owners} />}
      </div>
    </div>
  );
}

function UsersTab({ profiles }: { profiles: Profile[] }) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const inviteUser = async () => {
    if (!inviteEmail) return;
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setMessage("Invitation sent!");
        setInviteEmail("");
        setShowInvite(false);
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

  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
        <h2 className="font-semibold text-slate-900">Users</h2>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-teal-600 transition"
        >
          + Invite User
        </button>
      </div>

      {showInvite && (
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="user@example.com"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs text-slate-500 mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              onClick={inviteUser}
              disabled={loading || !inviteEmail}
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "..." : "Send Invite"}
            </button>
          </div>
          {message && (
            <p className={`text-xs mt-2 ${message.includes("Error") || message.includes("Failed") ? "text-red-600" : "text-emerald-600"}`}>
              {message}
            </p>
          )}
        </div>
      )}

      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 text-left text-slate-500 uppercase tracking-wide">
            <th className="px-4 py-2 font-semibold">User</th>
            <th className="px-4 py-2 font-semibold w-32">Role</th>
            <th className="px-4 py-2 font-semibold w-28">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {profiles.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                No users yet. Users are created when they sign up.
              </td>
            </tr>
          ) : (
            profiles.map((profile) => (
              <tr key={profile.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-900">
                    {profile.full_name || "—"}
                  </div>
                  <div className="text-slate-500">{profile.email}</div>
                </td>
                <td className="px-4 py-2">
                  <select
                    value={profile.role || "user"}
                    onChange={(e) => updateRole(profile.id, e.target.value)}
                    className={`rounded px-2 py-1 text-xs font-semibold ${
                      profile.role === "admin"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {new Date(profile.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
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
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="font-semibold text-slate-900">Projects</h2>
        <button
          onClick={() => { setShowAdd(!showAdd); setEditingId(null); setName(""); setDescription(""); }}
          className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
        >
          + Add Project
        </button>
      </div>

      {showAdd && (
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="Project name"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
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
          <tr className="bg-slate-50 text-left text-slate-500 uppercase tracking-wide">
            <th className="px-4 py-2 font-semibold">Project</th>
            <th className="px-4 py-2 font-semibold">Description</th>
            <th className="px-4 py-2 font-semibold w-28">Created</th>
            <th className="px-4 py-2 font-semibold w-20">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {projects.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                No projects yet. Add your first project above.
              </td>
            </tr>
          ) : (
            projects.map((project) => (
              <tr key={project.id} className="hover:bg-slate-50">
                {editingId === project.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 text-slate-500">
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
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {project.name}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {project.description || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
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
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="font-semibold text-slate-900">Owners</h2>
        <button
          onClick={() => { setShowAdd(!showAdd); setEditingId(null); setName(""); setEmail(""); setPhone(""); }}
          className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
        >
          + Add Owner
        </button>
      </div>

      {showAdd && (
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="Owner name"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="owner@example.com"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Phone (optional)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
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
          <tr className="bg-slate-50 text-left text-slate-500 uppercase tracking-wide">
            <th className="px-4 py-2 font-semibold">Name</th>
            <th className="px-4 py-2 font-semibold">Email</th>
            <th className="px-4 py-2 font-semibold">Phone</th>
            <th className="px-4 py-2 font-semibold w-28">Created</th>
            <th className="px-4 py-2 font-semibold w-20">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {owners.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                No owners yet. Add your first owner above.
              </td>
            </tr>
          ) : (
            owners.map((owner) => (
              <tr key={owner.id} className="hover:bg-slate-50">
                {editingId === owner.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                        placeholder="Optional"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                        placeholder="Optional"
                      />
                    </td>
                    <td className="px-4 py-2 text-slate-500">
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
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {owner.name}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {owner.email || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {owner.phone || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
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

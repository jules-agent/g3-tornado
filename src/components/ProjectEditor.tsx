"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  name: string;
  description: string | null;
  is_up?: boolean;
  is_bp?: boolean;
  is_upfit?: boolean;
  is_bpas?: boolean;
  visibility?: string;
  created_by?: string;
  created_at: string;
};

export function ProjectEditor({
  projects,
  creatorNames,
  currentUserId,
  isAdmin,
}: {
  projects: Project[];
  creatorNames: Record<string, string>;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editIsUp, setEditIsUp] = useState(false);
  const [editIsBp, setEditIsBp] = useState(false);
  const [editIsUpfit, setEditIsUpfit] = useState(false);
  const [editIsBpas, setEditIsBpas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const canEdit = (project: Project) => isAdmin || project.created_by === currentUserId;

  const startEdit = (p: Project) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditDesc(p.description || "");
    setEditIsUp(p.is_up || false);
    setEditIsBp(p.is_bp || false);
    setEditIsUpfit(p.is_upfit || false);
    setEditIsBpas(p.is_bpas || false);
    setMessage("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setMessage("");
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          name: editName.trim(),
          description: editDesc.trim() || null,
          is_up: editIsUp,
          is_bp: editIsBp,
          is_upfit: editIsUpfit,
          is_bpas: editIsBpas,
        }),
      });
      if (res.ok) {
        setMessage("✅ Saved");
        setEditingId(null);
        router.refresh();
      } else {
        const data = await res.json();
        setMessage(`❌ ${data.error || "Failed to save"}`);
      }
    } catch {
      setMessage("❌ Network error");
    }
    setSaving(false);
  };

  if (projects.length === 0) {
    return (
      <div className="mt-8 text-center text-slate-400">
        <p className="text-2xl mb-2">📂</p>
        <p className="text-sm">No projects to edit yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {message && !editingId && (
        <div className={`rounded-lg px-3 py-2 text-xs font-medium ${message.includes("❌") ? "bg-red-50 dark:bg-red-900/20 text-red-600" : "bg-green-50 dark:bg-green-900/20 text-green-600"}`}>
          {message}
        </div>
      )}
      {projects.map((project) => {
        const isEditing = editingId === project.id;
        const editable = canEdit(project);
        const creator = project.created_by ? creatorNames[project.created_by] : null;

        return (
          <div
            key={project.id}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm"
          >
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Name</label>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Description</label>
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={3}
                    placeholder="Describe this project's purpose, goals, or scope..."
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  />
                </div>
                {isAdmin && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Company</label>
                    <div className="flex gap-2">
                      {[
                        { label: "UP", val: editIsUp, set: setEditIsUp },
                        { label: "BP", val: editIsBp, set: setEditIsBp },
                        { label: "UPFIT", val: editIsUpfit, set: setEditIsUpfit },
                        { label: "BPAS", val: editIsBpas, set: setEditIsBpas },
                      ].map(({ label, val, set }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => set(!val)}
                          className={`rounded-lg px-4 py-1.5 text-xs font-bold border-2 transition ${
                            val ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white" : "bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-600"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {message && (
                  <div className={`text-xs ${message.includes("❌") ? "text-red-600" : "text-green-600"}`}>{message}</div>
                )}
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving} className="rounded-lg bg-teal-500 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-50">
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button onClick={cancelEdit} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{project.name}</h3>
                    <div className="flex gap-1">
                      {project.is_up && <span className="rounded bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">UP</span>}
                      {project.is_bp && <span className="rounded bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">BP</span>}
                      {project.is_upfit && <span className="rounded bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">UPFIT</span>}
                      {project.is_bpas && <span className="rounded bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300" title="Bulletproof Auto Spa">BPAS</span>}
                      {project.visibility === "personal" && <span className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">🔒 Personal</span>}
                    </div>
                  </div>
                  {project.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{project.description}</p>
                  )}
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                    Created by {creator || "Unknown"} • {new Date(project.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                {editable && (
                  <button
                    onClick={() => startEdit(project)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    ✏️ Edit
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  task_count?: number;
};

export default function ManageProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    
    // Get projects
    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, name, description, status")
      .order("name");
    
    // Get task counts per project
    const { data: tasks } = await supabase
      .from("tasks")
      .select("project_id");
    
    const countMap: Record<string, number> = {};
    tasks?.forEach(t => {
      if (t.project_id) {
        countMap[t.project_id] = (countMap[t.project_id] || 0) + 1;
      }
    });
    
    const withCounts = (projectsData || []).map(p => ({
      ...p,
      task_count: countMap[p.id] || 0
    }));
    
    setProjects(withCounts);
    setLoading(false);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    
    const { error } = await supabase
      .from("projects")
      .insert({ name: newName.trim(), status: "active" });
    
    if (!error) {
      setNewName("");
      await loadProjects();
    }
    setSaving(false);
  }

  async function handleSave(id: string) {
    if (!editingName.trim()) return;
    setSaving(true);
    
    await supabase
      .from("projects")
      .update({ name: editingName.trim() })
      .eq("id", id);
    
    setEditingId(null);
    setEditingName("");
    await loadProjects();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    
    if (project.task_count && project.task_count > 0) {
      alert(`Cannot delete "${project.name}" - it has ${project.task_count} task(s). Move or delete the tasks first.`);
      return;
    }
    
    if (!confirm(`Delete project "${project.name}"?`)) {
      return;
    }
    
    setSaving(true);
    await supabase.from("projects").delete().eq("id", id);
    await loadProjects();
    setSaving(false);
  }

  async function toggleStatus(id: string, currentStatus: string) {
    setSaving(true);
    const newStatus = currentStatus === "active" ? "archived" : "active";
    await supabase.from("projects").update({ status: newStatus }).eq("id", id);
    await loadProjects();
    setSaving(false);
  }

  function startEdit(project: Project) {
    setEditingId(project.id);
    setEditingName(project.name);
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            ← Back to tasks
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            Manage Projects
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Edit project names and manage their status.
          </p>
        </div>
      </div>

      {/* Add new */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add new project..."
          className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={saving || !newName.trim()}
          className="px-4 py-2 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No projects added yet.</div>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg ${project.status === "archived" ? "opacity-60" : ""}`}
            >
              {editingId === project.id ? (
                <>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-teal-300 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave(project.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <button
                    onClick={() => handleSave(project.id)}
                    disabled={saving}
                    className="px-3 py-1.5 bg-teal-500 text-white rounded text-sm font-medium hover:bg-teal-600 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-slate-900 dark:text-white">
                    {project.name}
                    {project.status === "archived" && (
                      <span className="ml-2 text-xs text-slate-400">(archived)</span>
                    )}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {project.task_count} task{project.task_count !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => toggleStatus(project.id, project.status)}
                    disabled={saving}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-50"
                    title={project.status === "active" ? "Archive" : "Unarchive"}
                  >
                    {project.status === "active" ? "📦" : "📂"}
                  </button>
                  <button
                    onClick={() => startEdit(project)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    disabled={saving || (project.task_count ?? 0) > 0}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded disabled:opacity-50"
                    title={project.task_count ? "Has tasks - cannot delete" : "Delete"}
                  >
                    🗑️
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Project = {
  id: string;
  name: string;
};

type Owner = {
  id: string;
  name: string;
};

type TaskFormProps = {
  mode: "create" | "edit";
  taskId?: string;
  projects: Project[];
  owners: Owner[];
  initialValues?: {
    task_number?: string | null;
    description: string;
    project_id: string;
    fu_cadence_days: number;
    status?: string;
    is_blocked?: boolean;
    blocker_description?: string | null;
  };
  selectedOwnerIds?: string[];
};

const NEW_PROJECT_VALUE = "__new_project__";

export default function TaskForm({
  mode,
  taskId,
  projects,
  owners,
  initialValues,
  selectedOwnerIds = [],
}: TaskFormProps) {
  const router = useRouter();
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [projectId, setProjectId] = useState(
    initialValues?.project_id ?? projects[0]?.id ?? ""
  );
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [fuCadenceDays, setFuCadenceDays] = useState(
    initialValues?.fu_cadence_days ?? 7
  );
  const [status, setStatus] = useState(initialValues?.status ?? "open");
  const [taskNumber, setTaskNumber] = useState(initialValues?.task_number ?? "");
  const [isBlocked, setIsBlocked] = useState(initialValues?.is_blocked ?? false);
  const [blockerDescription, setBlockerDescription] = useState(
    initialValues?.blocker_description ?? ""
  );
  const [ownerIds, setOwnerIds] = useState<string[]>(selectedOwnerIds);
  const [isAddingOwner, setIsAddingOwner] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOwnerPhone, setNewOwnerPhone] = useState("");
  const [isCreatingOwner, setIsCreatingOwner] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const hasProjects = projects.length > 0;
  const canSubmitProject = Boolean(projectId && projectId !== NEW_PROJECT_VALUE);

  const ownerLookup = useMemo(() => {
    return new Map(owners.map((owner) => [owner.id, owner.name]));
  }, [owners]);

  const handleOwnerToggle = (ownerId: string) => {
    setOwnerIds((prev) =>
      prev.includes(ownerId)
        ? prev.filter((id) => id !== ownerId)
        : [...prev, ownerId]
    );
  };

  const handleOwnerInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void createOwner();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setIsAddingOwner(false);
      setOwnerError(null);
      setNewOwnerName("");
      setNewOwnerEmail("");
      setNewOwnerPhone("");
    }
  };

  const createProject = async () => {
    if (isCreatingProject) return;
    const trimmedName = newProjectName.trim();
    if (!trimmedName) return;
    setIsCreatingProject(true);
    setProjectError(null);

    try {
      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setProjectError(data?.error ?? "Unable to create project.");
        setIsCreatingProject(false);
        return;
      }

      if (!data?.id) {
        setProjectError("Unable to create project.");
        setIsCreatingProject(false);
        return;
      }

      setProjectId(data.id);
      setNewProjectName("");
      setIsAddingProject(false);
      router.refresh();
    } catch {
      setProjectError("Unable to create project.");
    }
    setIsCreatingProject(false);
  };

  const createOwner = async () => {
    if (isCreatingOwner) return;
    const trimmedName = newOwnerName.trim();
    if (!trimmedName) return;
    setIsCreatingOwner(true);
    setOwnerError(null);

    try {
      const res = await fetch("/api/admin/owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: newOwnerEmail.trim() || null,
          phone: newOwnerPhone.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setOwnerError(data?.error ?? "Unable to create owner.");
        setIsCreatingOwner(false);
        return;
      }

      if (!data?.id) {
        setOwnerError("Unable to create owner.");
        setIsCreatingOwner(false);
        return;
      }

      setOwnerIds((prev) => (prev.includes(data.id) ? prev : [...prev, data.id]));
      setNewOwnerName("");
      setNewOwnerEmail("");
      setNewOwnerPhone("");
      setIsAddingOwner(false);
      router.refresh();
    } catch {
      setOwnerError("Unable to create owner.");
    }
    setIsCreatingOwner(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);

    const supabase = createClient();

    if (!canSubmitProject) {
      setError(
        projectId === NEW_PROJECT_VALUE
          ? "Please finish adding the new project."
          : "Please select a project."
      );
      setIsSaving(false);
      return;
    }

    if (mode === "create") {
      const { data, error: insertError } = await supabase
        .from("tasks")
        .insert({
          description,
          project_id: projectId,
          fu_cadence_days: fuCadenceDays,
          status,
          task_number: taskNumber || null,
          is_blocked: isBlocked,
          blocker_description: isBlocked ? blockerDescription : null,
        })
        .select("id")
        .single();

      if (insertError || !data?.id) {
        setError(insertError?.message ?? "Unable to create task.");
        setIsSaving(false);
        return;
      }

      if (ownerIds.length > 0) {
        const { error: ownerError } = await supabase
          .from("task_owners")
          .insert(ownerIds.map((ownerId) => ({ task_id: data.id, owner_id: ownerId })));

        if (ownerError) {
          setError(ownerError.message);
          setIsSaving(false);
          return;
        }
      }

      router.push(`/tasks/${data.id}`);
      router.refresh();
      return;
    }

    if (!taskId) {
      setError("Missing task id for edit.");
      setIsSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        description,
        project_id: projectId,
        fu_cadence_days: fuCadenceDays,
        status,
        task_number: taskNumber || null,
        is_blocked: isBlocked,
        blocker_description: isBlocked ? blockerDescription : null,
      })
      .eq("id", taskId);

    if (updateError) {
      setError(updateError.message);
      setIsSaving(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from("task_owners")
      .delete()
      .eq("task_id", taskId);

    if (deleteError) {
      setError(deleteError.message);
      setIsSaving(false);
      return;
    }

    if (ownerIds.length > 0) {
      const { error: ownerError } = await supabase
        .from("task_owners")
        .insert(ownerIds.map((ownerId) => ({ task_id: taskId, owner_id: ownerId })));

      if (ownerError) {
        setError(ownerError.message);
        setIsSaving(false);
        return;
      }
    }

    router.refresh();
    setIsSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Task description
            </label>
            <textarea
              required
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
              placeholder="Describe the task, outcome, or blocker..."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Project
              </label>
              <select
                required
                value={projectId}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === NEW_PROJECT_VALUE) {
                    setIsAddingProject(true);
                    setProjectId(NEW_PROJECT_VALUE);
                    setProjectError(null);
                    return;
                  }
                  setIsAddingProject(false);
                  setProjectId(value);
                  setProjectError(null);
                }}
                disabled={isCreatingProject}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
              >
                <option value="" disabled>
                  {hasProjects ? "Select a project" : "Add a project"}
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
                <option value={NEW_PROJECT_VALUE}>+ New Project</option>
              </select>
              {isAddingProject && (
                <div className="mt-2 space-y-2">
                  <input
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void createProject();
                      }
                      if (event.key === "Escape") {
                        setIsAddingProject(false);
                        setProjectId(projects[0]?.id ?? "");
                      }
                    }}
                    onBlur={() => {
                      void createProject();
                    }}
                    placeholder="Project name"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                  {projectError && (
                    <div className="text-xs text-rose-600">{projectError}</div>
                  )}
                  {isCreatingProject && (
                    <div className="text-xs text-slate-400">Creating project...</div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Follow-up cadence (days)
              </label>
              <input
                type="number"
                min={1}
                value={fuCadenceDays}
                onChange={(event) => setFuCadenceDays(Number(event.target.value))}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Task number (optional)
              </label>
              <input
                value={taskNumber ?? ""}
                onChange={(event) => setTaskNumber(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
              >
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="blocked">Blocked</option>
                <option value="pending_close">Pending close</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <input
                id="is-blocked"
                type="checkbox"
                checked={isBlocked}
                onChange={(event) => setIsBlocked(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              <label htmlFor="is-blocked" className="text-sm font-medium text-slate-700">
                Task is blocked
              </label>
            </div>
            {isBlocked && (
              <div className="mt-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Blocker description
                </label>
                <textarea
                  value={blockerDescription}
                  onChange={(event) => setBlockerDescription(event.target.value)}
                  rows={2}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  placeholder="What is blocking progress?"
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Owners</div>
            <div className="mt-3 space-y-2">
              {owners.map((owner) => (
                <label
                  key={owner.id}
                  className="flex items-center gap-2 text-sm text-slate-600"
                >
                  <input
                    type="checkbox"
                    checked={ownerIds.includes(owner.id)}
                    onChange={() => handleOwnerToggle(owner.id)}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900"
                  />
                  <span>{owner.name}</span>
                </label>
              ))}
              {owners.length === 0 && (
                <div className="text-sm text-slate-400">No owners available.</div>
              )}
            </div>
            <div className="mt-4">
              {isAddingOwner ? (
                <div className="space-y-2">
                  <input
                    value={newOwnerName}
                    onChange={(event) => setNewOwnerName(event.target.value)}
                    onKeyDown={handleOwnerInputKeyDown}
                    placeholder="Owner name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="email"
                      value={newOwnerEmail}
                      onChange={(event) => setNewOwnerEmail(event.target.value)}
                      onKeyDown={handleOwnerInputKeyDown}
                      placeholder="Email (optional)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    />
                    <input
                      type="tel"
                      value={newOwnerPhone}
                      onChange={(event) => setNewOwnerPhone(event.target.value)}
                      onKeyDown={handleOwnerInputKeyDown}
                      placeholder="Phone (optional)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void createOwner()}
                      disabled={isCreatingOwner || !newOwnerName.trim()}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {isCreatingOwner ? "Adding..." : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingOwner(false);
                        setOwnerError(null);
                        setNewOwnerName("");
                        setNewOwnerEmail("");
                        setNewOwnerPhone("");
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                  {ownerError && (
                    <div className="text-xs text-rose-600">{ownerError}</div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingOwner(true);
                    setOwnerError(null);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  + Add Owner
                </button>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Selected owners
            </div>
            <div className="mt-2 text-sm text-slate-700">
              {ownerIds.length === 0
                ? "None selected"
                : ownerIds.map((id) => ownerLookup.get(id)).filter(Boolean).join(", ")}
            </div>
          </div>
        </div>
      </div>

      {!hasProjects && !isAddingProject && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          You need at least one project before creating tasks.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSaving || !canSubmitProject}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSaving
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
            ? "Create task"
            : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

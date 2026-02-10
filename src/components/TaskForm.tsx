"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Project = {
  id: string;
  name: string;
  is_up?: boolean;
  is_bp?: boolean;
  is_upfit?: boolean;
  visibility?: string;
  created_by?: string;
  one_on_one_owner_id?: string;
};

type Owner = {
  id: string;
  name: string;
  is_up_employee?: boolean;
  is_bp_employee?: boolean;
  is_upfit_employee?: boolean;
  is_third_party_vendor?: boolean;
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
  const searchParams = useSearchParams();
  const parkingId = searchParams.get("parking");
  const parkingDesc = searchParams.get("desc");
  const [description, setDescription] = useState(parkingDesc || (initialValues?.description ?? ""));
  const [projectId, setProjectId] = useState(
    initialValues?.project_id ?? (mode === "edit" ? projects[0]?.id ?? "" : "")
  );
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [newProjectVisibility, setNewProjectVisibility] = useState<"personal" | "shared" | "one_on_one">("shared");
  const [oneOnOneOwnerId, setOneOnOneOwnerId] = useState<string>("");
  const [newProjectIsUp, setNewProjectIsUp] = useState(false);
  const [newProjectIsBp, setNewProjectIsBp] = useState(false);
  const [newProjectIsUpfit, setNewProjectIsUpfit] = useState(false);
  const [fuCadenceDays, setFuCadenceDays] = useState(
    initialValues?.fu_cadence_days ?? 3
  );
  const [status, setStatus] = useState(initialValues?.status ?? "open");
  const [taskNumber, setTaskNumber] = useState(initialValues?.task_number ?? "");
  const [isBlocked, setIsBlocked] = useState(initialValues?.is_blocked ?? false);
  const [blockerDescription, setBlockerDescription] = useState(
    initialValues?.blocker_description ?? ""
  );
  const [ownerIds, setOwnerIds] = useState<string[]>(selectedOwnerIds);

  // Gate/Blocker state (create mode)
  const [hasGate, setHasGate] = useState(false);
  const [gateOwnerId, setGateOwnerId] = useState<string>("");
  const [gateName, setGateName] = useState("");
  const [blockerCategory, setBlockerCategory] = useState<string>("");
  const [isAddingGateName, setIsAddingGateName] = useState(false);

  // Edit mode owner state
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

  // Auto-assign current user as owner on create
  const [currentUserOwnerId, setCurrentUserOwnerId] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== "create") return;
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("owner_id").eq("id", user.id).maybeSingle();
        if (profile?.owner_id) {
          setCurrentUserOwnerId(profile.owner_id);
          setOwnerIds(prev => prev.includes(profile.owner_id) ? prev : [...prev, profile.owner_id]);
        }
      }
    };
    fetchUser();
  }, [mode]);

  // Staff and vendors for gate selector
  const { employees: allStaff, vendors: allVendors } = useMemo(() => {
    const staff = owners.filter(o => !o.is_third_party_vendor);
    const vends = owners.filter(o => o.is_third_party_vendor);
    return { employees: staff, vendors: vends };
  }, [owners]);

  // Filter owners based on selected project's business units (for edit mode)
  const { employees: filteredEmployees, vendors: filteredVendors } = useMemo(() => {
    const selectedProject = projects.find(p => p.id === projectId);
    const hasAnyFlag = selectedProject?.is_up || selectedProject?.is_bp || selectedProject?.is_upfit;

    if (!hasAnyFlag) {
      const emps = owners.filter(o => !o.is_third_party_vendor);
      const vends = owners.filter(o => o.is_third_party_vendor);
      return { employees: emps, vendors: vends };
    }

    const employees = owners.filter(o => {
      if (o.is_third_party_vendor) return false;
      if (selectedProject?.is_up && o.is_up_employee) return true;
      if (selectedProject?.is_bp && o.is_bp_employee) return true;
      if (selectedProject?.is_upfit && o.is_upfit_employee) return true;
      if (!o.is_up_employee && !o.is_bp_employee && !o.is_upfit_employee && !o.is_third_party_vendor) return true;
      return false;
    });

    const vendors = owners.filter(o => o.is_third_party_vendor);
    return { employees, vendors };
  }, [owners, projects, projectId]);

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
        body: JSON.stringify({
          name: trimmedName,
          visibility: newProjectVisibility === "one_on_one" ? "one_on_one" : newProjectVisibility,
          is_up: newProjectVisibility === "shared" ? newProjectIsUp : false,
          is_bp: newProjectVisibility === "shared" ? newProjectIsBp : false,
          is_upfit: newProjectVisibility === "shared" ? newProjectIsUpfit : false,
          one_on_one_owner_id: newProjectVisibility === "one_on_one" ? oneOnOneOwnerId : null,
        }),
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
      setNewProjectVisibility("shared");
      setNewProjectIsUp(false);
      setNewProjectIsBp(false);
      setNewProjectIsUpfit(false);
      setOneOnOneOwnerId("");
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
      // Auto-generate task number
      const { data: maxTask } = await supabase
        .from("tasks")
        .select("task_number")
        .not("task_number", "is", null)
        .order("task_number", { ascending: false })
        .limit(1)
        .single();

      let nextNumber = "T-001";
      if (maxTask?.task_number) {
        const match = maxTask.task_number.match(/(\d+)$/);
        if (match) {
          nextNumber = `T-${String(parseInt(match[1], 10) + 1).padStart(3, "0")}`;
        }
      }

      const { data, error: insertError } = await supabase
        .from("tasks")
        .insert({
          description,
          project_id: projectId,
          fu_cadence_days: fuCadenceDays,
          status: "open",
          task_number: nextNumber,
          is_blocked: hasGate,
          blocker_description: hasGate && gateName ? gateName : null,
          blocker_category: hasGate ? blockerCategory || null : null,
          gates: hasGate && gateOwnerId ? [{
            name: gateName || "Gate",
            owner_name: ownerLookup.get(gateOwnerId) || "",
            completed: false,
          }] : null,
        })
        .select("id")
        .single();

      if (insertError || !data?.id) {
        setError(insertError?.message ?? "Unable to create task.");
        setIsSaving(false);
        return;
      }

      // Add current user as owner
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

      // Mark parking lot item as spawned
      if (parkingId) {
        await fetch("/api/parking-lot", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: parkingId, spawned_task_id: data.id }),
        });
      }

      router.push("/?filter=open");
      router.refresh();
      return;
    }

    // EDIT MODE
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

  // ========== CREATE MODE ==========
  if (mode === "create") {
    return (
      <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
        {/* Description */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Task description
          </label>
          <textarea
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
            placeholder="Describe the task, outcome, or blocker..."
          />
        </div>

        {/* Project */}
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
            {projects.filter(p => p.visibility === "personal").length > 0 && (
              <optgroup label="Personal">
                {projects.filter(p => p.visibility === "personal").map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </optgroup>
            )}
            {projects.filter(p => p.visibility === "one_on_one").length > 0 && (
              <optgroup label="One on One">
                {projects.filter(p => p.visibility === "one_on_one").map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </optgroup>
            )}
            {projects.filter(p => p.visibility !== "personal" && p.visibility !== "one_on_one").length > 0 && (
              <optgroup label="Shared / Team">
                {projects.filter(p => p.visibility !== "personal" && p.visibility !== "one_on_one").map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </optgroup>
            )}
            <option value={NEW_PROJECT_VALUE}>+ New Project</option>
          </select>
          {isAddingProject && (
            <div className="mt-2 space-y-3">
              {/* Visibility selector */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewProjectVisibility("personal")}
                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold border transition ${newProjectVisibility === "personal" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
                >
                  🔒 Personal
                </button>
                <button
                  type="button"
                  onClick={() => setNewProjectVisibility("shared")}
                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold border transition ${newProjectVisibility === "shared" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
                >
                  👥 Shared / Team
                </button>
                <button
                  type="button"
                  onClick={() => setNewProjectVisibility("one_on_one")}
                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold border transition ${newProjectVisibility === "one_on_one" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
                >
                  🤝 One on One
                </button>
              </div>

              <input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") { event.preventDefault(); void createProject(); }
                  if (event.key === "Escape") { setIsAddingProject(false); setProjectId(""); }
                }}
                placeholder="Project name"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                autoFocus
              />

              {/* Team selector for shared projects */}
              {newProjectVisibility === "shared" && (
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" checked={newProjectIsUp} onChange={(e) => setNewProjectIsUp(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300" />
                    UP
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" checked={newProjectIsBp} onChange={(e) => setNewProjectIsBp(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300" />
                    BP
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" checked={newProjectIsUpfit} onChange={(e) => setNewProjectIsUpfit(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300" />
                    UPFIT
                  </label>
                </div>
              )}

              {newProjectVisibility === "personal" && (
                <p className="text-[10px] text-slate-400">Only you will see this project and its tasks.</p>
              )}

              {newProjectVisibility === "one_on_one" && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Share with
                  </label>
                  <select
                    value={oneOnOneOwnerId}
                    onChange={(e) => setOneOnOneOwnerId(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  >
                    <option value="">Select a person...</option>
                    {allStaff.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-slate-400">Only you and this person will see tasks in this project. Shows under their &quot;Shared&quot; tab.</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void createProject()}
                  disabled={isCreatingProject || !newProjectName.trim()}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:bg-slate-400"
                >
                  {isCreatingProject ? "Creating..." : "Create Project"}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAddingProject(false); setProjectId(""); }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
              {projectError && <div className="text-xs text-rose-600">{projectError}</div>}
            </div>
          )}
        </div>

        {/* Cadence + Gate only show after project is selected */}
        {canSubmitProject && (
        <>
        {/* Cadence */}
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

        {/* Gate/Blocker */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <input
              id="has-gate"
              type="checkbox"
              checked={hasGate}
              onChange={(event) => setHasGate(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900"
            />
            <label htmlFor="has-gate" className="text-sm font-medium text-slate-700">
              Is there a Gate / Blocker?
            </label>
          </div>
          {hasGate && (
            <div className="mt-4 space-y-3">
              {/* Blocker Category */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Blocker Category
                </label>
                <select
                  value={blockerCategory}
                  onChange={(e) => setBlockerCategory(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                >
                  <option value="">Select category...</option>
                  <option value="vendor">🏭 Vendor</option>
                  <option value="engineering">⚙️ Engineering</option>
                  <option value="design">🎨 Design</option>
                  <option value="decision">🧑‍💼 Waiting on Decision</option>
                  <option value="other">❓ Other</option>
                </select>
              </div>

              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Gate Selector
              </label>
              <select
                value={gateOwnerId}
                onChange={(e) => setGateOwnerId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
              >
                <option value="">Select gate person...</option>
                {allStaff.length > 0 && (
                  <optgroup label="Staff">
                    {allStaff.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </optgroup>
                )}
                {allVendors.length > 0 && (
                  <optgroup label="3rd Party Vendors">
                    {allVendors.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>

              {/* Gate Name */}
              {isAddingGateName ? (
                <div>
                  <input
                    value={gateName}
                    onChange={(e) => setGateName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") { setIsAddingGateName(false); setGateName(""); } }}
                    placeholder="Gate name (e.g. Waiting for parts, Approval needed...)"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    autoFocus
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingGateName(true)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  + Add Gate Name
                </button>
              )}
              {gateName && !isAddingGateName && (
                <div className="text-xs text-slate-500">
                  Gate: <span className="font-medium text-slate-700">{gateName}</span>
                  <button type="button" onClick={() => { setIsAddingGateName(true); }} className="ml-2 text-slate-400 hover:text-slate-600">✏️</button>
                </div>
              )}
            </div>
          )}
        </div>
        </>
        )}

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
            {isSaving ? "Creating..." : "Create task"}
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

  // ========== EDIT MODE (unchanged) ==========
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
                      if (event.key === "Enter") { event.preventDefault(); void createProject(); }
                      if (event.key === "Escape") { setIsAddingProject(false); setProjectId(projects[0]?.id ?? ""); }
                    }}
                    onBlur={() => void createProject()}
                    placeholder="Project name"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                  {projectError && <div className="text-xs text-rose-600">{projectError}</div>}
                  {isCreatingProject && <div className="text-xs text-slate-400">Creating project...</div>}
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
                Task number
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
              {filteredEmployees.map((owner) => (
                <label key={owner.id} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={ownerIds.includes(owner.id)}
                    onChange={() => handleOwnerToggle(owner.id)}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900"
                  />
                  <span>{owner.name}</span>
                </label>
              ))}
              {filteredVendors.length > 0 && filteredEmployees.length > 0 && (
                <div className="border-t border-slate-200 my-2 pt-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">3rd Party Vendors</div>
                </div>
              )}
              {filteredVendors.map((owner) => (
                <label key={owner.id} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={ownerIds.includes(owner.id)}
                    onChange={() => handleOwnerToggle(owner.id)}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900"
                  />
                  <span>{owner.name}</span>
                </label>
              ))}
              {filteredEmployees.length === 0 && filteredVendors.length === 0 && (
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
                    <button type="button" onClick={() => void createOwner()} disabled={isCreatingOwner || !newOwnerName.trim()} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
                      {isCreatingOwner ? "Adding..." : "Add"}
                    </button>
                    <button type="button" onClick={() => { setIsAddingOwner(false); setOwnerError(null); setNewOwnerName(""); setNewOwnerEmail(""); setNewOwnerPhone(""); }} className="text-xs font-semibold text-slate-500 hover:text-slate-700">
                      Cancel
                    </button>
                  </div>
                  {ownerError && <div className="text-xs text-rose-600">{ownerError}</div>}
                </div>
              ) : (
                <button type="button" onClick={() => { setIsAddingOwner(true); setOwnerError(null); }} className="text-xs font-semibold text-slate-500 hover:text-slate-700">
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
          {isSaving ? "Saving..." : "Save changes"}
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

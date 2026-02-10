"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { filterContactsByProject, filterProjectsByUser } from "@/lib/utils";

/** Auto-capitalize first letter of each word as user types */
function autoCapitalizeWords(value: string): string {
  return value.replace(/(^|\.\s+|\n)([a-z])/g, (_, prefix, char) => prefix + char.toUpperCase())
              .replace(/(^|[^a-zA-Z])([a-z])/g, (_, prefix, char) => prefix + char.toUpperCase());
}

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
  creatorNames?: Record<string, string>;
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
  creatorNames = {},
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

  // Company association for this task (determines contact filtering)
  const [taskIsUp, setTaskIsUp] = useState(false);
  const [taskIsBp, setTaskIsBp] = useState(false);
  const [taskIsUpfit, setTaskIsUpfit] = useState(false);
  const [taskIsPersonal, setTaskIsPersonal] = useState(false);

  // Template state
  const [templates, setTemplates] = useState<{ id: string; name: string; gates: { name: string; owner_name: string }[]; company_scope: { is_up: boolean; is_bp: boolean; is_upfit: boolean } }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  // Fetch approved templates
  useEffect(() => {
    fetch("/api/templates").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setTemplates(data.filter((t: { status: string }) => t.status === "approved"));
    }).catch(() => {});
  }, []);

  // Gate/Blocker state (create mode) — unlimited gates
  const [hasGate, setHasGate] = useState(false);
  const [createGates, setCreateGates] = useState<{ name: string; ownerId: string }[]>([{ name: "", ownerId: "" }]);
  // Legacy compat
  const gateOwnerId = createGates[0]?.ownerId || "";
  const gateName = createGates[0]?.name || "";
  const [isAddingGateContact, setIsAddingGateContact] = useState(false);
  const [newGateContactName, setNewGateContactName] = useState("");
  const [isCreatingGateContact, setIsCreatingGateContact] = useState(false);
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

  // Auto-assign current user as owner on create & get admin status
  const [currentUserOwnerId, setCurrentUserOwnerId] = useState<string | null>(null);
  const [currentUserOwner, setCurrentUserOwner] = useState<{
    is_up_employee?: boolean; is_bp_employee?: boolean; is_upfit_employee?: boolean; is_third_party_vendor?: boolean;
  } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("owner_id, role").eq("id", user.id).maybeSingle();
        const adminStatus = profile?.role === "admin" || user.email === "ben@unpluggedperformance.com";
        setIsAdmin(adminStatus);
        if (profile?.owner_id) {
          setCurrentUserOwnerId(profile.owner_id);
          if (mode === "create") {
            setOwnerIds(prev => prev.includes(profile.owner_id) ? prev : [...prev, profile.owner_id]);
          }
          // Fetch owner record for company flags
          const { data: ownerRecord } = await supabase
            .from("owners")
            .select("is_up_employee, is_bp_employee, is_upfit_employee, is_third_party_vendor")
            .eq("id", profile.owner_id)
            .maybeSingle();
          setCurrentUserOwner(ownerRecord);
        }
      }
    };
    fetchUser();
  }, [mode]);

  // Filter projects by user's company access
  const visibleProjects = useMemo(() => {
    return filterProjectsByUser(projects, currentUserOwner, isAdmin);
  }, [projects, currentUserOwner, isAdmin]);

  // Staff and vendors for gate selector
  const { employees: allStaff, vendors: allVendors } = useMemo(() => {
    const staff = owners.filter(o => !o.is_third_party_vendor);
    const vends = owners.filter(o => o.is_third_party_vendor);
    return { employees: staff, vendors: vends };
  }, [owners]);

  // Filter contacts based on task-level company flags (or project flags as fallback)
  const { employees: filteredEmployees, vendors: filteredVendors } = useMemo(() => {
    // Use task-level company selection if any are set
    const hasTaskFlags = taskIsUp || taskIsBp || taskIsUpfit;
    const companyContext = hasTaskFlags
      ? { is_up: taskIsUp, is_bp: taskIsBp, is_upfit: taskIsUpfit }
      : taskIsPersonal
        ? null // Personal = no company filtering, but limited to user
        : projects.find(p => p.id === projectId) || null;
    
    const filteredContacts = filterContactsByProject(owners, companyContext, isAdmin);
    
    const employees = filteredContacts.filter(o => !o.is_third_party_vendor);
    const vendors = filteredContacts.filter(o => o.is_third_party_vendor);
    
    return { employees, vendors };
  }, [owners, projects, projectId, isAdmin, taskIsUp, taskIsBp, taskIsUpfit, taskIsPersonal]);

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
      // Transfer company flags from the new project form to the task-level selector
      if (newProjectVisibility === "personal") {
        setTaskIsPersonal(true);
        setTaskIsUp(false); setTaskIsBp(false); setTaskIsUpfit(false);
      } else if (newProjectVisibility === "shared") {
        setTaskIsPersonal(false);
        setTaskIsUp(newProjectIsUp);
        setTaskIsBp(newProjectIsBp);
        setTaskIsUpfit(newProjectIsUpfit);
      }
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

  const handleCreateGateContact = async () => {
    if (isCreatingGateContact || !newGateContactName.trim()) return;
    setIsCreatingGateContact(true);
    const supabase = createClient();
    const { data, error: insertErr } = await supabase
      .from("owners")
      .insert({
        name: newGateContactName.trim(),
        is_up_employee: taskIsUp,
        is_bp_employee: taskIsBp,
        is_upfit_employee: taskIsUpfit,
        is_third_party_vendor: false,
        is_internal: false,
      })
      .select("id")
      .single();
    if (!insertErr && data?.id) {
      const updated = [...createGates];
      if (updated.length > 0) updated[0] = { ...updated[0], ownerId: data.id };
      setCreateGates(updated);
      setNewGateContactName("");
      setIsAddingGateContact(false);
      // Refresh page to get updated owners list
      router.refresh();
    }
    setIsCreatingGateContact(false);
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
      // Validate company selection
      if (!taskIsUp && !taskIsBp && !taskIsUpfit && !taskIsPersonal) {
        setError("Please select which company this task applies to (UP, BP, UPFIT, or Personal).");
        setIsSaving(false);
        return;
      }

      // Update project company flags to match task selection (for shared projects)
      if (!taskIsPersonal && projectId && projectId !== NEW_PROJECT_VALUE) {
        await supabase
          .from("projects")
          .update({ is_up: taskIsUp, is_bp: taskIsBp, is_upfit: taskIsUpfit })
          .eq("id", projectId);
      }

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
          blocker_description: hasGate && createGates[0]?.name ? createGates[0].name : null,
          blocker_category: null,
          gates: hasGate ? createGates
            .filter(g => g.ownerId || g.name)
            .map(g => ({
              name: g.name || "Gate",
              owner_name: ownerLookup.get(g.ownerId) || "",
              completed: false,
            })) : null,
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
            onChange={(event) => setDescription(autoCapitalizeWords(event.target.value))}
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
              // Auto-populate company flags from selected project
              const proj = projects.find(p => p.id === value);
              if (proj) {
                if (proj.visibility === "personal") {
                  setTaskIsPersonal(true);
                  setTaskIsUp(false); setTaskIsBp(false); setTaskIsUpfit(false);
                } else {
                  setTaskIsPersonal(false);
                  setTaskIsUp(!!proj.is_up);
                  setTaskIsBp(!!proj.is_bp);
                  setTaskIsUpfit(!!proj.is_upfit);
                }
              }
            }}
            disabled={isCreatingProject}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
          >
            <option value="" disabled>
              {hasProjects ? "Select a project" : "Add a project"}
            </option>
            {visibleProjects.filter(p => p.visibility === "personal").length > 0 && (
              <optgroup label="Personal">
                {visibleProjects.filter(p => p.visibility === "personal").map((project) => (
                  <option key={project.id} value={project.id}>{project.name}{project.created_by && creatorNames[project.created_by] ? ` (${creatorNames[project.created_by]})` : ""}</option>
                ))}
              </optgroup>
            )}
            {visibleProjects.filter(p => p.visibility === "one_on_one").length > 0 && (
              <optgroup label="One on One">
                {visibleProjects.filter(p => p.visibility === "one_on_one").map((project) => (
                  <option key={project.id} value={project.id}>{project.name}{project.created_by && creatorNames[project.created_by] ? ` (${creatorNames[project.created_by]})` : ""}</option>
                ))}
              </optgroup>
            )}
            {visibleProjects.filter(p => p.visibility !== "personal" && p.visibility !== "one_on_one").length > 0 && (
              <optgroup label="Shared / Team">
                {visibleProjects.filter(p => p.visibility !== "personal" && p.visibility !== "one_on_one").map((project) => (
                  <option key={project.id} value={project.id}>{project.name}{project.created_by && creatorNames[project.created_by] ? ` (${creatorNames[project.created_by]})` : ""}</option>
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

        {/* Company association + Cadence + Gate only show after project is selected */}
        {canSubmitProject && (
        <>
        {/* Company Association */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Which company does this apply to? <span className="text-red-400">*</span>
          </label>
          {(() => {
            const selectedProject = projects.find(p => p.id === projectId);
            const hasNoFlags = !taskIsUp && !taskIsBp && !taskIsUpfit && !taskIsPersonal;
            return (
              <>
                {selectedProject && hasNoFlags && (
                  <p className="text-[10px] text-amber-600 mt-1 mb-2 font-medium">⚠️ This project has no company set yet — please select one below.</p>
                )}
                {!hasNoFlags && (
                  <p className="text-[10px] text-slate-400 mt-0.5 mb-2">
                    {taskIsPersonal ? "Personal — only you will see this." : `Applies to: ${[taskIsUp && "UP", taskIsBp && "BP", taskIsUpfit && "UPFIT"].filter(Boolean).join(", ")}`}
                  </p>
                )}
              </>
            );
          })()}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setTaskIsUp(!taskIsUp); setTaskIsPersonal(false); }}
              className={`rounded-xl px-5 py-3 text-sm font-bold border-2 transition ${taskIsUp ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"}`}
            >
              UP
            </button>
            <button
              type="button"
              onClick={() => { setTaskIsBp(!taskIsBp); setTaskIsPersonal(false); }}
              className={`rounded-xl px-5 py-3 text-sm font-bold border-2 transition ${taskIsBp ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"}`}
            >
              BP
            </button>
            <button
              type="button"
              onClick={() => { setTaskIsUpfit(!taskIsUpfit); setTaskIsPersonal(false); }}
              className={`rounded-xl px-5 py-3 text-sm font-bold border-2 transition ${taskIsUpfit ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"}`}
            >
              UPFIT
            </button>
            <button
              type="button"
              onClick={() => { setTaskIsPersonal(!taskIsPersonal); setTaskIsUp(false); setTaskIsBp(false); setTaskIsUpfit(false); }}
              className={`rounded-xl px-5 py-3 text-sm font-bold border-2 transition ${taskIsPersonal ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"}`}
            >
              🔒 Personal
            </button>
          </div>
        </div>

        {/* Use Template */}
        {(() => {
          const matching = templates.filter(t => {
            const s = t.company_scope;
            return (taskIsUp && s.is_up) || (taskIsBp && s.is_bp) || (taskIsUpfit && s.is_upfit);
          });
          if (matching.length === 0) return null;
          return (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Use Template <span className="text-slate-400">(optional)</span>
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => {
                  const tpl = matching.find(t => t.id === e.target.value);
                  setSelectedTemplate(e.target.value);
                  if (tpl) {
                    setHasGate(true);
                    // Map all template gates to createGates
                    const tplGates = (tpl.gates || []).map((g: { name?: string; owner_name?: string }) => {
                      const match = owners.find(o => o.name.toLowerCase() === g.owner_name?.toLowerCase());
                      return { name: g.name || "", ownerId: match?.id || "" };
                    });
                    setCreateGates(tplGates.length > 0 ? tplGates : [{ name: "", ownerId: "" }]);
                  } else {
                    setSelectedTemplate("");
                  }
                }}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
              >
                <option value="">No template — manual setup</option>
                {matching.map(t => (
                  <option key={t.id} value={t.id}>📋 {t.name} ({t.gates.length} gates)</option>
                ))}
              </select>
            </div>
          );
        })()}

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

        {/* Gate Sequence */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <input
              id="has-gate"
              type="checkbox"
              checked={hasGate}
              onChange={(event) => {
                setHasGate(event.target.checked);
                if (event.target.checked && createGates.length === 0) {
                  setCreateGates([{ name: "", ownerId: "" }]);
                }
              }}
              className="h-4 w-4 rounded border-slate-300 text-slate-900"
            />
            <label htmlFor="has-gate" className="text-sm font-medium text-slate-700">
              Add Gates / Blockers
            </label>
          </div>
          {hasGate && (
            <div className="mt-4 space-y-2">
              {createGates.map((gate, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
                  <span className="text-xs font-bold text-slate-400 pt-2 w-5 text-center">{idx + 1}</span>
                  <div className="flex-1 space-y-1.5">
                    <input
                      value={gate.name}
                      onChange={(e) => {
                        const updated = [...createGates];
                        updated[idx] = { ...updated[idx], name: autoCapitalizeWords(e.target.value) };
                        setCreateGates(updated);
                      }}
                      placeholder="Gate description (e.g. Waiting For Parts, Approval Needed...)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    />
                    <select
                      value={gate.ownerId}
                      onChange={(e) => {
                        const updated = [...createGates];
                        updated[idx] = { ...updated[idx], ownerId: e.target.value };
                        setCreateGates(updated);
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                    >
                      <option value="">Select gate person...</option>
                      {filteredEmployees.length > 0 && (
                        <optgroup label="Employees">
                          {filteredEmployees.map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {filteredVendors.length > 0 && (
                        <optgroup label="3rd Party Vendors">
                          {filteredVendors.map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5 pt-1">
                    <button type="button" onClick={() => { if (idx > 0) { const u = [...createGates]; [u[idx], u[idx-1]] = [u[idx-1], u[idx]]; setCreateGates(u); } }} disabled={idx === 0} className="text-[10px] text-slate-400 hover:text-slate-600 disabled:opacity-20">▲</button>
                    <button type="button" onClick={() => { if (idx < createGates.length - 1) { const u = [...createGates]; [u[idx], u[idx+1]] = [u[idx+1], u[idx]]; setCreateGates(u); } }} disabled={idx === createGates.length - 1} className="text-[10px] text-slate-400 hover:text-slate-600 disabled:opacity-20">▼</button>
                    {createGates.length > 1 && (
                      <button type="button" onClick={() => setCreateGates(createGates.filter((_, i) => i !== idx))} className="text-xs text-red-400 hover:text-red-600 mt-1">✕</button>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setCreateGates([...createGates, { name: "", ownerId: "" }])}
                className="w-full rounded-xl border-2 border-dashed border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:border-teal-400 hover:text-teal-600 transition"
              >
                + Add Another Gate
              </button>
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
                {visibleProjects.map((project) => (
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
            <div className="text-sm font-semibold text-slate-900">Contacts</div>
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
                    placeholder="Contact name"
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
                  + Add Contact
                </button>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Selected contacts
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

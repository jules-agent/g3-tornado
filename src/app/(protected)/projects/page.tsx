import { createClient } from "@/lib/supabase/server";
import { getEffectiveUser } from "@/lib/impersonation";
import { redirect } from "next/navigation";
import { ProjectEditor } from "@/components/ProjectEditor";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const effectiveUser = await getEffectiveUser();
  if (!effectiveUser) redirect("/login");

  const isAdmin = effectiveUser.role === "admin" || effectiveUser.email === "ben@unpluggedperformance.com";

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, description, is_up, is_bp, is_upfit, visibility, created_by, one_on_one_owner_id, created_at")
    .order("name");

  // Get all profiles for creator names
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email");

  const creatorNames: Record<string, string> = {};
  (profiles || []).forEach((p) => {
    creatorNames[p.id] = p.full_name || p.email || "Unknown";
  });

  // Users see: projects they created + shared projects they have access to
  const visibleProjects = isAdmin
    ? (projects || [])
    : (projects || []).filter((p) => p.created_by === effectiveUser.effectiveUserId);

  return (
    <div className="max-w-3xl mx-auto py-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">My Projects</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        Edit your project details. {isAdmin ? "As admin, you can edit all projects." : "You can edit projects you created."}
      </p>
      <ProjectEditor
        projects={visibleProjects}
        creatorNames={creatorNames}
        currentUserId={effectiveUser.effectiveUserId}
        isAdmin={isAdmin}
      />
    </div>
  );
}

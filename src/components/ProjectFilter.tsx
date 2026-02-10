"use client";

import { useRouter } from "next/navigation";

type Project = {
  id: string;
  name: string;
  created_by?: string;
};

export function ProjectFilter({
  projects,
  currentFilter,
  currentProject,
  creatorNames = {},
}: {
  projects: Project[];
  currentFilter: string;
  currentProject: string;
  creatorNames?: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <select
      className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300"
      value={currentProject}
      onChange={(e) => {
        const val = e.target.value;
        if (val === "__edit__") {
          router.push("/projects");
          return;
        }
        router.push(`/?filter=${currentFilter}${val !== "all" ? `&project=${val}` : ""}`);
      }}
    >
      <option value="all">All Projects</option>
      {projects.map((p) => {
        const creator = p.created_by && creatorNames[p.created_by];
        return (
          <option key={p.id} value={p.id}>
            {p.name}{creator ? ` (${creator})` : ""}
          </option>
        );
      })}
      <option disabled>───────────</option>
      <option value="__edit__">✏️ Edit Projects...</option>
    </select>
  );
}

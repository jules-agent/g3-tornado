"use client";

import { useRouter } from "next/navigation";

type Project = {
  id: string;
  name: string;
};

export function ProjectFilter({
  projects,
  currentFilter,
  currentProject,
}: {
  projects: Project[];
  currentFilter: string;
  currentProject: string;
}) {
  const router = useRouter();

  return (
    <select
      className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600"
      value={currentProject}
      onChange={(e) => {
        const val = e.target.value;
        router.push(`/?filter=${currentFilter}${val !== "all" ? `&project=${val}` : ""}`);
      }}
    >
      <option value="all">All Projects</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

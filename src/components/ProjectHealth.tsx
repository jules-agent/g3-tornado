"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type ProjectSummary = {
  id: string;
  name: string;
  customerName: string | null;
  deadline: string | null;
  bufferDays: number;
  realDeadline: string | null; // deadline minus buffer
  daysRemaining: number | null;
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
  atRiskTasks: RiskTask[];
  healthStatus: "green" | "amber" | "red" | "critical" | "no-deadline";
  completionPercent: number;
};

type RiskTask = {
  id: string;
  taskNumber: string;
  description: string;
  daysOverdue: number;
  blockerCategory: string | null;
  blockerDescription: string | null;
  gatePerson: string | null;
  ownerNames: string;
  riskLevel: "watch" | "at-risk" | "critical";
};

function getRiskLevel(daysOverdue: number, daysToRealDeadline: number | null): "watch" | "at-risk" | "critical" {
  if (daysToRealDeadline !== null && daysToRealDeadline <= 7) return "critical";
  if (daysToRealDeadline !== null && daysToRealDeadline <= 14) return "at-risk";
  if (daysOverdue > 0) return "watch";
  return "watch";
}

function getHealthStatus(project: { daysRemaining: number | null; atRiskTasks: RiskTask[]; completionPercent: number; deadline: string | null }): "green" | "amber" | "red" | "critical" | "no-deadline" {
  if (!project.deadline) return "no-deadline";
  const criticalCount = project.atRiskTasks.filter(t => t.riskLevel === "critical").length;
  const atRiskCount = project.atRiskTasks.filter(t => t.riskLevel === "at-risk").length;
  if (criticalCount > 0 || (project.daysRemaining !== null && project.daysRemaining <= 3 && project.completionPercent < 100)) return "critical";
  if (atRiskCount > 0 || (project.daysRemaining !== null && project.daysRemaining <= 14 && project.completionPercent < 80)) return "red";
  if (project.atRiskTasks.length > 0) return "amber";
  return "green";
}

const healthLabels = {
  "green": { label: "On Track", emoji: "🟢", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" },
  "amber": { label: "Watch", emoji: "🟡", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" },
  "red": { label: "At Risk", emoji: "🔴", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" },
  "critical": { label: "CRITICAL", emoji: "⚫", color: "text-red-700 dark:text-red-300", bg: "bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-700" },
  "no-deadline": { label: "No Deadline", emoji: "⚪", color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700" },
};

const blockerIcons: Record<string, string> = {
  vendor: "🏭",
  engineering: "⚙️",
  design: "🎨",
  decision: "🧑‍💼",
  other: "❓",
};

export function ProjectHealth({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    const fetchData = async () => {
      const supabase = createClient();

      const [{ data: projectsData }, { data: tasks }] = await Promise.all([
        supabase.from("projects").select("id, name, deadline, buffer_days, customer_name").order("deadline", { ascending: true, nullsFirst: false }),
        supabase.from("tasks").select(`
          id, task_number, description, status, fu_cadence_days, last_movement_at, project_id,
          is_blocked, blocker_description, blocker_category, gates,
          task_owners (owner_id, owners (id, name))
        `),
      ]);

      if (!projectsData) { setLoading(false); return; }

      const now = Date.now();
      const summaries: ProjectSummary[] = [];

      for (const proj of projectsData) {
        const projectTasks = (tasks || []).filter((t: any) => t.project_id === proj.id);
        const completed = projectTasks.filter((t: any) => t.status === "closed").length;
        const open = projectTasks.filter((t: any) => t.status === "open").length;
        const total = projectTasks.length;
        const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

        const bufferDays = proj.buffer_days || 7;
        let realDeadline: string | null = null;
        let daysRemaining: number | null = null;

        if (proj.deadline) {
          const dl = new Date(proj.deadline);
          const real = new Date(dl);
          real.setDate(real.getDate() - bufferDays);
          realDeadline = real.toISOString().split("T")[0];
          daysRemaining = Math.ceil((real.getTime() - now) / (1000 * 60 * 60 * 24));
        }

        // Find at-risk tasks
        const atRiskTasks: RiskTask[] = [];
        for (const task of projectTasks) {
          if ((task as any).status !== "open") continue;
          const daysSince = Math.floor(
            (now - new Date((task as any).last_movement_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          const daysOverdue = daysSince - (task as any).fu_cadence_days;
          if (daysOverdue <= 0) continue; // not overdue

          const t = task as any;
          let gatePerson: string | null = null;
          if (t.gates && Array.isArray(t.gates)) {
            const active = t.gates.find((g: any) => !g.completed);
            if (active) gatePerson = active.owner_name || null;
          }

          const ownerNames = t.task_owners?.map((to: any) => to.owners?.name).filter(Boolean).join(", ") || "Unassigned";
          const riskLevel = getRiskLevel(daysOverdue, daysRemaining);

          atRiskTasks.push({
            id: t.id,
            taskNumber: t.task_number || "—",
            description: t.description,
            daysOverdue,
            blockerCategory: t.blocker_category || null,
            blockerDescription: t.blocker_description || null,
            gatePerson,
            ownerNames,
            riskLevel,
          });
        }

        // Sort risk tasks: critical first
        atRiskTasks.sort((a, b) => {
          const order = { critical: 0, "at-risk": 1, watch: 2 };
          return order[a.riskLevel] - order[b.riskLevel] || b.daysOverdue - a.daysOverdue;
        });

        const summary: ProjectSummary = {
          id: proj.id,
          name: proj.name,
          customerName: proj.customer_name,
          deadline: proj.deadline,
          bufferDays,
          realDeadline,
          daysRemaining,
          totalTasks: total,
          completedTasks: completed,
          openTasks: open,
          atRiskTasks,
          healthStatus: "green",
          completionPercent,
        };
        summary.healthStatus = getHealthStatus(summary);
        summaries.push(summary);
      }

      // Sort: critical/red first, then by deadline
      summaries.sort((a, b) => {
        const statusOrder = { critical: 0, red: 1, amber: 2, green: 3, "no-deadline": 4 };
        const diff = statusOrder[a.healthStatus] - statusOrder[b.healthStatus];
        if (diff !== 0) return diff;
        if (a.daysRemaining === null) return 1;
        if (b.daysRemaining === null) return -1;
        return a.daysRemaining - b.daysRemaining;
      });

      setProjects(summaries);
      setLoading(false);
    };

    fetchData();
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const criticalCount = projects.filter(p => p.healthStatus === "critical" || p.healthStatus === "red").length;

  const content = (
    <div className="fixed inset-0 z-[9999] bg-white dark:bg-slate-950 overflow-y-auto" style={{ isolation: "isolate" }}>
      <style>{`body { overflow: hidden !important; }`}</style>

      <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🎯</span>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Project Health</h1>
            <p className="text-xs text-slate-500">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
              {criticalCount > 0 && <span className="text-red-600 dark:text-red-400 font-semibold"> · {criticalCount} need attention</span>}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition"
        >
          ← Back to Tasks
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📁</div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No projects yet</h2>
            <p className="text-slate-500">Create a project and add tasks to see health tracking.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => {
              const health = healthLabels[project.healthStatus];
              const isExpanded = expandedProject === project.id;

              return (
                <div key={project.id} className={`rounded-2xl border ${health.bg} overflow-hidden transition-all`}>
                  {/* Project header */}
                  <button
                    onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                    className="w-full text-left px-5 py-4 flex items-center gap-4"
                  >
                    <div className="text-2xl">{health.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">{project.name}</h3>
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${health.color}`}>{health.label}</span>
                        {project.customerName && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/50 dark:bg-slate-800/50 text-slate-500">👤 {project.customerName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-[10px] text-slate-500">
                        {project.deadline ? (
                          <>
                            <span>📅 Due: {new Date(project.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            <span className={`font-semibold ${
                              project.daysRemaining !== null && project.daysRemaining <= 7 ? "text-red-600 dark:text-red-400" :
                              project.daysRemaining !== null && project.daysRemaining <= 14 ? "text-amber-600 dark:text-amber-400" :
                              "text-slate-600 dark:text-slate-400"
                            }`}>
                              {project.daysRemaining !== null ? (
                                project.daysRemaining <= 0 ? `⚠️ ${Math.abs(project.daysRemaining)}d past internal deadline` : `${project.daysRemaining}d to internal deadline`
                              ) : ""}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400">No deadline set</span>
                        )}
                        <span>{project.completedTasks}/{project.totalTasks} items</span>
                        {project.atRiskTasks.length > 0 && (
                          <span className="text-red-600 dark:text-red-400 font-semibold">{project.atRiskTasks.length} at risk</span>
                        )}
                      </div>
                    </div>

                    {/* Progress ring */}
                    <div className="flex-shrink-0 relative w-12 h-12">
                      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5"
                          className="text-slate-200 dark:text-slate-700" />
                        <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5"
                          strokeDasharray={`${project.completionPercent} ${100 - project.completionPercent}`}
                          strokeLinecap="round"
                          className={`${
                            project.completionPercent === 100 ? "text-green-500" :
                            project.healthStatus === "critical" ? "text-red-500" :
                            project.healthStatus === "red" ? "text-red-400" :
                            "text-teal-500"
                          } transition-all duration-1000`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-300">
                        {project.completionPercent}%
                      </div>
                    </div>

                    {/* Expand arrow */}
                    <div className={`text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>▼</div>
                  </button>

                  {/* Expanded: at-risk items */}
                  {isExpanded && (
                    <div className="border-t border-slate-200/50 dark:border-slate-700/50 px-5 pb-4">
                      {project.atRiskTasks.length === 0 ? (
                        <div className="py-6 text-center text-sm text-slate-400">
                          ✅ All items on track — no overdue tasks
                        </div>
                      ) : (
                        <div className="space-y-2 mt-3">
                          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                            ⚠️ Items needing attention ({project.atRiskTasks.length})
                          </div>
                          {project.atRiskTasks.map((task) => (
                            <div
                              key={task.id}
                              className={`rounded-lg p-3 flex items-start gap-3 ${
                                task.riskLevel === "critical" ? "bg-red-100/80 dark:bg-red-950/40" :
                                task.riskLevel === "at-risk" ? "bg-amber-100/80 dark:bg-amber-950/40" :
                                "bg-white/60 dark:bg-slate-800/60"
                              }`}
                            >
                              <div className="flex-shrink-0 text-sm mt-0.5">
                                {task.riskLevel === "critical" ? "⚫" : task.riskLevel === "at-risk" ? "🔴" : "🟡"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-mono text-slate-400">{task.taskNumber}</span>
                                  <span className={`text-[10px] font-bold uppercase ${
                                    task.riskLevel === "critical" ? "text-red-700 dark:text-red-300" :
                                    task.riskLevel === "at-risk" ? "text-red-600 dark:text-red-400" :
                                    "text-amber-600 dark:text-amber-400"
                                  }`}>
                                    {task.riskLevel === "critical" ? "CRITICAL" : task.riskLevel === "at-risk" ? "AT RISK" : "WATCH"}
                                  </span>
                                  <span className="text-[10px] text-slate-400">{task.daysOverdue}d overdue</span>
                                  {task.blockerCategory && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">
                                      {blockerIcons[task.blockerCategory] || "❓"} {task.blockerCategory}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-800 dark:text-slate-200 mt-0.5 line-clamp-2">{task.description}</p>
                                {(task.gatePerson || task.blockerDescription) && (
                                  <p className="text-[10px] text-slate-500 mt-1">
                                    {task.gatePerson ? `🚧 Waiting on: ${task.gatePerson}` : ""}
                                    {task.gatePerson && task.blockerDescription ? " — " : ""}
                                    {task.blockerDescription || ""}
                                  </p>
                                )}
                                <p className="text-[10px] text-slate-400 mt-0.5">Owners: {task.ownerNames}</p>
                              </div>
                              <Link
                                href={`/tasks/${task.id}`}
                                onClick={onClose}
                                className="flex-shrink-0 text-[10px] font-semibold text-teal-600 dark:text-teal-400 hover:underline mt-1"
                              >
                                Open →
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

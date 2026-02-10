"use client";

import { useState } from "react";

const SAMPLE_TEMPLATES = [
  {
    id: "inventory-intake",
    name: "Inventory Intake",
    company: "UP",
    description: "New part received — inspect, allocate, ship",
    gates: [
      { owner: "Operations", task: "Inspect part & verify PO#" },
      { owner: "Operations", task: "QC pass/fail inspection" },
      { owner: "Accounting", task: "Allocate to B/O by aging SO priority" },
      { owner: "Operations", task: "Execute shipping" },
    ],
  },
  {
    id: "customer-build",
    name: "Customer Build",
    company: "BP",
    description: "Full custom build workflow from order to delivery",
    gates: [
      { owner: "Sales", task: "Confirm order details & deposit" },
      { owner: "Parts Dept", task: "Order all required parts" },
      { owner: "Operations", task: "Schedule build slot" },
      { owner: "Tech Lead", task: "Complete build" },
      { owner: "QC", task: "Final inspection & photos" },
      { owner: "Sales", task: "Notify customer & arrange delivery" },
    ],
  },
  {
    id: "fleet-vehicle",
    name: "Fleet Vehicle Upfit",
    company: "UPFIT",
    description: "Government/fleet vehicle modification workflow",
    gates: [
      { owner: "Project Manager", task: "Confirm specs & SOW with client" },
      { owner: "Procurement", task: "Source & order upfit components" },
      { owner: "Operations", task: "Vehicle intake & baseline inspection" },
      { owner: "Tech Team", task: "Complete upfit installation" },
      { owner: "QC", task: "Inspection & compliance verification" },
      { owner: "Project Manager", task: "Client walkthrough & sign-off" },
    ],
  },
  {
    id: "vendor-po",
    name: "Vendor PO Follow-up",
    company: "UP",
    description: "Track purchase orders through to delivery",
    gates: [
      { owner: "Purchasing", task: "Submit PO to vendor" },
      { owner: "Vendor", task: "Confirm lead time & ship date" },
      { owner: "Purchasing", task: "Track shipment" },
      { owner: "Receiving", task: "Receive & verify against PO" },
    ],
  },
];

function CompanyBadge({ company }: { company: string }) {
  const colors: Record<string, string> = {
    UP: "bg-blue-100 text-blue-700 border-blue-200",
    BP: "bg-purple-100 text-purple-700 border-purple-200",
    UPFIT: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colors[company] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {company}
    </span>
  );
}

export default function TemplatesDemo() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [view, setView] = useState<"select" | "preview" | "applied">("select");
  const [taskDescription, setTaskDescription] = useState("");

  const template = SAMPLE_TEMPLATES.find((t) => t.id === selectedTemplate);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">🧩 Task Templates — Concept Preview</h1>
            <p className="text-xs text-slate-500 mt-0.5">This is a design prototype. Click around to see how it would work.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setView("select"); setSelectedTemplate(null); setTaskDescription(""); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${view === "select" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              1. Browse Templates
            </button>
            <button
              onClick={() => { if (template) setView("preview"); }}
              disabled={!template}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${view === "preview" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"} disabled:opacity-40`}
            >
              2. Preview Gates
            </button>
            <button
              onClick={() => { if (template) setView("applied"); }}
              disabled={!template}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${view === "applied" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"} disabled:opacity-40`}
            >
              3. Create Task View
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* ===== VIEW 1: Template Selection ===== */}
        {view === "select" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Choose a Template</h2>
              <p className="text-sm text-slate-500 mt-1">Templates appear in the task creation form. Select one to auto-fill the gate/blocker sequence.</p>
            </div>

            {/* Where it lives callout */}
            <div className="rounded-2xl border-2 border-dashed border-teal-300 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-950/20 p-5 mb-6">
              <div className="text-xs font-bold uppercase tracking-wide text-teal-600 dark:text-teal-400 mb-2">📍 Where this appears</div>
              <p className="text-sm text-teal-800 dark:text-teal-200">
                In the <strong>Create New Task</strong> form, right after selecting a project and company. A new section: 
                <strong> &quot;Use a Template? (optional)&quot;</strong> — showing template cards filtered by the selected company.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {SAMPLE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTemplate(t.id); setView("preview"); }}
                  className={`text-left rounded-2xl border-2 p-5 transition hover:shadow-lg ${
                    selectedTemplate === t.id
                      ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30 shadow-md"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">🧩</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{t.name}</span>
                    <CompanyBadge company={t.company} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t.description}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {t.gates.map((g, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {g.owner}
                        </span>
                        {i < t.gates.length - 1 && <span className="text-slate-300 dark:text-slate-600 text-xs">→</span>}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            {/* Admin manage link */}
            <div className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">⚙️ Admin: Manage Templates</h3>
              <p className="text-xs text-slate-500 mb-3">Admins can create, edit, and delete templates from the Admin panel → Templates tab.</p>
              <div className="flex gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-teal-500 text-white text-xs font-semibold">+ Create Template</span>
                <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold">Edit Existing</span>
                <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold">Duplicate</span>
              </div>
            </div>
          </div>
        )}

        {/* ===== VIEW 2: Template Preview ===== */}
        {view === "preview" && template && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                🧩 {template.name}
                <CompanyBadge company={template.company} />
              </h2>
              <p className="text-sm text-slate-500 mt-1">{template.description}</p>
            </div>

            {/* Where it lives callout */}
            <div className="rounded-2xl border-2 border-dashed border-teal-300 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-950/20 p-5 mb-6">
              <div className="text-xs font-bold uppercase tracking-wide text-teal-600 dark:text-teal-400 mb-2">📍 What happens when you select a template</div>
              <p className="text-sm text-teal-800 dark:text-teal-200">
                The gate sequence below auto-populates in the task form. You can <strong>edit, reorder, add, or remove</strong> any gates before creating the task. The template is a starting point, not a lock.
              </p>
            </div>

            {/* Gate sequence visualization */}
            <div className="space-y-0">
              {template.gates.map((gate, i) => (
                <div key={i} className="flex items-start gap-4">
                  {/* Timeline */}
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      i === 0 ? "bg-teal-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}>
                      {i + 1}
                    </div>
                    {i < template.gates.length - 1 && (
                      <div className="w-0.5 h-12 bg-slate-200 dark:bg-slate-700" />
                    )}
                  </div>

                  {/* Gate card */}
                  <div className={`flex-1 rounded-xl border p-4 mb-3 ${
                    i === 0
                      ? "border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Gate {i + 1}</span>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">{gate.task}</div>
                        <div className="text-xs text-slate-500 mt-1">👤 {gate.owner}</div>
                      </div>
                      <div className="flex gap-1">
                        <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 text-xs">✏️</button>
                        <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 text-xs">🗑️</button>
                        <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 text-xs">↕️</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setView("applied")}
                className="px-5 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition shadow-sm"
              >
                Use This Template →
              </button>
              <button
                onClick={() => { setView("select"); setSelectedTemplate(null); }}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:border-slate-300 transition"
              >
                ← Pick Different
              </button>
            </div>
          </div>
        )}

        {/* ===== VIEW 3: Applied to Task Form ===== */}
        {view === "applied" && template && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create New Task</h2>
              <p className="text-sm text-slate-500 mt-1">This is how the task form looks with a template applied.</p>
            </div>

            <div className="max-w-xl space-y-5">
              {/* Description */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Task Description</label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  placeholder="e.g. New shipment of Model Y spoilers received..."
                />
              </div>

              {/* Project (mock) */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project</label>
                <div className="mt-2 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-700">
                  Model Y Parts
                </div>
              </div>

              {/* Company (mock) */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company</label>
                <div className="flex gap-2 mt-2">
                  <span className="rounded-xl px-5 py-3 text-sm font-bold border-2 bg-slate-900 text-white border-slate-900 shadow-md">UP</span>
                  <span className="rounded-xl px-5 py-3 text-sm font-bold border-2 bg-white text-slate-500 border-slate-200">BP</span>
                  <span className="rounded-xl px-5 py-3 text-sm font-bold border-2 bg-white text-slate-500 border-slate-200">UPFIT</span>
                  <span className="rounded-xl px-5 py-3 text-sm font-bold border-2 bg-white text-slate-500 border-slate-200">🔒 Personal</span>
                </div>
              </div>

              {/* Template applied indicator */}
              <div className="rounded-2xl border-2 border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🧩</span>
                    <span className="text-sm font-bold text-teal-800 dark:text-teal-200">Template: {template.name}</span>
                    <CompanyBadge company={template.company} />
                  </div>
                  <button className="text-xs text-teal-600 hover:text-teal-700 font-semibold">✕ Remove Template</button>
                </div>

                {/* Auto-populated gates */}
                <div className="space-y-2">
                  {template.gates.map((gate, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                      <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">{gate.task}</div>
                        <div className="text-[10px] text-slate-500">👤 {gate.owner}</div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button className="text-[10px] text-slate-400 hover:text-slate-600 p-1">✏️</button>
                        <button className="text-[10px] text-slate-400 hover:text-red-500 p-1">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="mt-2 text-xs font-semibold text-teal-600 hover:text-teal-700">+ Add Another Gate</button>
              </div>

              {/* Cadence (mock) */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Follow-up Cadence (days)</label>
                <input
                  type="number"
                  defaultValue={3}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3">
                <button className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition">
                  Create Task
                </button>
                <button
                  onClick={() => setView("select")}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:border-slate-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

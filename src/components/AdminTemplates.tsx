"use client";

import { useEffect, useState } from "react";

type GateStep = { name: string; owner_name: string; order: number; completed: boolean };
type Template = {
  id: string;
  name: string;
  description: string | null;
  company_scope: { is_up: boolean; is_bp: boolean; is_upfit: boolean; is_bpas: boolean };
  gates: GateStep[];
  created_by_email: string | null;
  status: string;
  proposed_at: string;
  approved_at: string | null;
};

function CompanyBadges({ scope }: { scope: Template["company_scope"] }) {
  return (
    <span className="inline-flex gap-1">
      {scope.is_up && <span className="rounded bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">UP</span>}
      {scope.is_bp && <span className="rounded bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">BP</span>}
      {scope.is_upfit && <span className="rounded bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">UPFIT</span>}
      {scope.is_bpas && <span className="rounded bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300" title="Bulletproof Auto Spa">BPAS</span>}
    </span>
  );
}

function TemplateCard({
  template,
  onAction,
}: {
  template: Template;
  onAction: (id: string, action: string, data?: Record<string, unknown>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(template.name);
  const [editDesc, setEditDesc] = useState(template.description || "");
  const [editGates, setEditGates] = useState<GateStep[]>(template.gates);
  const [editScope, setEditScope] = useState(template.company_scope);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onAction(template.id, "edit", {
      name: editName,
      description: editDesc || null,
      gates: editGates,
      company_scope: editScope,
    });
    setSaving(false);
    setEditing(false);
  };

  const statusColors: Record<string, string> = {
    proposed: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    disabled: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColors[template.status] || statusColors.proposed}`}>
              {template.status}
            </span>
            <CompanyBadges scope={template.company_scope} />
          </div>

          {editing ? (
            <div className="space-y-2 mt-2">
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-semibold text-slate-900 dark:text-white"
              />
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 resize-none"
                placeholder="Description..."
              />
              <div className="flex gap-2">
                {(["is_up", "is_bp", "is_upfit", "is_bpas"] as const).map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEditScope({ ...editScope, [key]: !editScope[key] })}
                    className={`rounded px-3 py-1 text-[10px] font-bold border ${editScope[key] ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900" : "bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-600"}`}
                  >
                    {key.replace("is_", "").toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Gates</p>
                {editGates.map((g, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 w-4">{i + 1}.</span>
                    <input
                      value={g.name}
                      onChange={e => { const u = [...editGates]; u[i] = { ...u[i], name: e.target.value }; setEditGates(u); }}
                      className="flex-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-900 dark:text-white"
                      placeholder="Gate description"
                    />
                    <input
                      value={g.owner_name}
                      onChange={e => { const u = [...editGates]; u[i] = { ...u[i], owner_name: e.target.value }; setEditGates(u); }}
                      className="w-32 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-900 dark:text-white"
                      placeholder="Person"
                    />
                    <button onClick={() => setEditGates(editGates.filter((_, j) => j !== i))} className="text-red-400 text-xs">✕</button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setEditGates([...editGates, { name: "", owner_name: "", order: editGates.length + 1, completed: false }])}
                  className="text-[10px] text-teal-600 font-semibold"
                >
                  + Add Gate
                </button>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={saving} className="rounded-lg bg-slate-900 dark:bg-white px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-80 disabled:opacity-50">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{template.name}</h3>
              {template.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{template.description}</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                {template.gates.map((g, i) => (
                  <span key={i} className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-300">
                    {i + 1}. {g.name} {g.owner_name && `→ ${g.owner_name}`}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                Proposed by {template.created_by_email || "unknown"} • {new Date(template.proposed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </>
          )}
        </div>

        {!editing && (
          <div className="flex flex-col gap-1">
            <button onClick={() => setEditing(true)} className="text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold">✏️ Edit</button>
            {template.status === "proposed" && (
              <button onClick={() => onAction(template.id, "approve")} className="text-[10px] text-green-600 hover:text-green-700 font-semibold">✅ Approve</button>
            )}
            {template.status === "approved" && (
              <button onClick={() => onAction(template.id, "disable")} className="text-[10px] text-amber-600 hover:text-amber-700 font-semibold">⏸ Disable</button>
            )}
            {template.status === "disabled" && (
              <button onClick={() => onAction(template.id, "approve")} className="text-[10px] text-green-600 hover:text-green-700 font-semibold">🔄 Re-enable</button>
            )}
            <button onClick={() => onAction(template.id, "delete")} className="text-[10px] text-red-400 hover:text-red-600 font-semibold">🗑 Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"proposed" | "approved" | "disabled">("proposed");

  const fetchTemplates = async () => {
    const res = await fetch("/api/templates");
    if (res.ok) setTemplates(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleAction = async (id: string, action: string, data?: Record<string, unknown>) => {
    if (action === "delete") {
      if (!confirm("Delete this template?")) return;
      await fetch(`/api/templates/${id}`, { method: "DELETE" });
    } else if (action === "approve") {
      await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
    } else if (action === "disable") {
      await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "disabled" }),
      });
    } else if (action === "edit" && data) {
      await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    fetchTemplates();
  };

  const filtered = templates.filter(t => t.status === tab);
  const counts = {
    proposed: templates.filter(t => t.status === "proposed").length,
    approved: templates.filter(t => t.status === "approved").length,
    disabled: templates.filter(t => t.status === "disabled").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["proposed", "approved", "disabled"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === t
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            {t === "proposed" ? "📬" : t === "approved" ? "✅" : "⏸"} {t.charAt(0).toUpperCase() + t.slice(1)} ({counts[t]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">
          No {tab} templates{tab === "proposed" ? " — users can propose from the toolbar 📋" : ""}.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => (
            <TemplateCard key={t.id} template={t} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  );
}

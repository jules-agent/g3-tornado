"use client";

import { useState } from "react";

export function CollapsibleSection({
  title,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {badge && (
            <span className="text-xs uppercase tracking-wide text-slate-400">
              {badge}
            </span>
          )}
        </div>
        <span className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

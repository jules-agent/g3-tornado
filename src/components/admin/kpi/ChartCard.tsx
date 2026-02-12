"use client";

import { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  loading?: boolean;
  className?: string;
}

export function ChartCard({ title, subtitle, children, loading, className = "" }: ChartCardProps) {
  if (loading) {
    return (
      <div className={`rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm p-5 ${className}`}>
        <div className="animate-pulse">
          <div className="h-3 w-32 rounded bg-slate-700/50 mb-2" />
          <div className="h-2 w-20 rounded bg-slate-700/50 mb-6" />
          <div className="h-48 rounded bg-slate-700/30" />
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm p-5 shadow-lg ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

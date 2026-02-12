"use client";

import { ReactNode } from "react";

interface KPICardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: "good" | "warning" | "critical" | "neutral";
  loading?: boolean;
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-slate-700/50 ${className || ""}`} />
  );
}

export function KPICard({ label, value, subtitle, icon, trend = "neutral", loading }: KPICardProps) {
  const trendColors = {
    good: "text-emerald-400",
    warning: "text-amber-400",
    critical: "text-red-400",
    neutral: "text-slate-300",
  };

  const trendBorder = {
    good: "border-emerald-500/20",
    warning: "border-amber-500/20",
    critical: "border-red-500/20",
    neutral: "border-slate-700",
  };

  const trendGlow = {
    good: "shadow-emerald-500/5",
    warning: "shadow-amber-500/5",
    critical: "shadow-red-500/5",
    neutral: "shadow-none",
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm p-5">
        <Skeleton className="h-3 w-20 mb-3" />
        <Skeleton className="h-8 w-28 mb-2" />
        <Skeleton className="h-3 w-16" />
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${trendBorder[trend]} bg-slate-800/50 backdrop-blur-sm p-5 shadow-lg ${trendGlow[trend]} transition-all hover:bg-slate-800/70 hover:scale-[1.01]`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <div className={`text-2xl font-bold tracking-tight ${trendColors[trend]}`}>
        {value}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      )}
    </div>
  );
}

export function KPICardSkeleton() {
  return <KPICard label="" value="" loading />;
}

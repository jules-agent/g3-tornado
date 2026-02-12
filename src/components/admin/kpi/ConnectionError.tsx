"use client";

import { ReactNode } from "react";

interface ConnectionErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  children?: ReactNode;
}

export function ConnectionError({
  title = "Unable to connect to Gigatron",
  message = "The ERP server may be offline. Showing demo data so you can preview the dashboard layout.",
  onRetry,
  children,
}: ConnectionErrorProps) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-sm p-4 mb-6">
      <div className="flex items-start gap-3">
        <span className="text-amber-400 text-lg mt-0.5">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-300">{title}</p>
          <p className="text-xs text-amber-400/70 mt-0.5">{message}</p>
          {children}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full ml-2">
      DEMO DATA
    </span>
  );
}

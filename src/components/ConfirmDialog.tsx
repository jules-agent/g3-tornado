"use client";

import { createPortal } from "react-dom";

type Props = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
};

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  loading = false,
}: Props) {
  if (!isOpen || typeof document === "undefined") return null;

  const confirmClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-teal-500 hover:bg-teal-600 text-white";

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-sm mx-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
        </div>
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 ${confirmClass}`}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

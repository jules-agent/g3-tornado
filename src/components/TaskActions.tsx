"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TaskActionsProps = {
  taskId: string;
  status: string;
  isAdmin: boolean;
  closeRequestedAt?: string | null;
};

export default function TaskActions({
  taskId,
  status,
  isAdmin,
  closeRequestedAt,
}: TaskActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleRequestClose = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        status: "pending_close",
        close_requested_at: new Date().toISOString(),
        close_requested_by: user?.id ?? null,
      })
      .eq("id", taskId);

    if (updateError) {
      setError(updateError.message);
      setIsSaving(false);
      return;
    }

    router.refresh();
    setIsSaving(false);
  };

  const handleCloseTask = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: user?.id ?? null,
      })
      .eq("id", taskId);

    if (updateError) {
      setError(updateError.message);
      setIsSaving(false);
      return;
    }

    router.refresh();
    setIsSaving(false);
  };

  return (
    <div className="space-y-3">
      {status === "closed" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          This task is closed.
        </div>
      ) : isAdmin ? (
        <button
          type="button"
          onClick={handleCloseTask}
          disabled={isSaving}
          className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
        >
          {isSaving ? "Closing..." : "Close task"}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleRequestClose}
          disabled={isSaving || status === "pending_close"}
          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "pending_close"
            ? "Close requested"
            : isSaving
            ? "Requesting..."
            : "Request close"}
        </button>
      )}

      {closeRequestedAt && status === "pending_close" && (
        <div className="text-xs text-slate-500">
          Close requested on {new Date(closeRequestedAt).toLocaleDateString()}.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}

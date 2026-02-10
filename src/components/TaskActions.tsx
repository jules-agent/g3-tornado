"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TaskActionsProps = {
  taskId: string;
  status: string;
  isAdmin: boolean;
  closeRequestedAt?: string | null;
  ownerCount?: number;
  isMyTask?: boolean;
};

export default function TaskActions({
  taskId,
  status,
  isAdmin,
  closeRequestedAt,
  ownerCount = 0,
  isMyTask = false,
}: TaskActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const handleDeleteTask = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 5000);
      return;
    }
    setIsSaving(true);
    setError(null);

    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Failed to delete task");
      setIsSaving(false);
      setConfirmDelete(false);
      return;
    }

    router.push("/");
    router.refresh();
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

      {/* Delete task — anyone can delete single-owner tasks; admins can delete anything */}
      {(isAdmin || (ownerCount <= 1 && isMyTask) || ownerCount === 0) && (
        <button
          type="button"
          onClick={handleDeleteTask}
          disabled={isSaving}
          className={`w-full rounded-xl px-4 py-2 text-sm font-semibold transition ${
            confirmDelete
              ? "bg-red-600 text-white hover:bg-red-700"
              : "border border-red-200 text-red-500 hover:border-red-300 hover:text-red-700 hover:bg-red-50"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isSaving ? "Deleting..." : confirmDelete ? "Click again to permanently delete" : "🗑️ Delete task"}
        </button>
      )}
      {!isAdmin && ownerCount > 1 && (
        <p className="text-[10px] text-slate-400 text-center">Shared tasks with multiple owners cannot be deleted. Ask an admin.</p>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}

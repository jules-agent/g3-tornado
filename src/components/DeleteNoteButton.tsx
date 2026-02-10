"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteNoteButton({ noteId, isSharedTask }: { noteId: string; isSharedTask: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  if (isSharedTask) return null;

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 4000);
      return;
    }

    setDeleting(true);
    const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || "Failed to delete note");
    }
    setDeleting(false);
    setConfirming(false);
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className={`text-xs transition ${
        confirming
          ? "text-red-600 dark:text-red-400 font-semibold hover:text-red-700"
          : "text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400"
      } disabled:opacity-50`}
      title={confirming ? "Click again to confirm" : "Delete note"}
    >
      {deleting ? "..." : confirming ? "Confirm delete?" : "✕"}
    </button>
  );
}

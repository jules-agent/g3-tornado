"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AddNoteFormProps = {
  taskId: string;
};

export default function AddNoteForm({ taskId }: AddNoteFormProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim()) return;
    if (isSaving) return;

    setIsSaving(true);
    setError(null);

    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("task_notes").insert({
      task_id: taskId,
      content: content.trim(),
      created_by: currentUser?.id ?? null,
    });

    if (insertError) {
      setError(insertError.message);
      setIsSaving(false);
      return;
    }

    setContent("");
    setIsSaving(false);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Add note
        </label>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
          placeholder="Share the latest update, blocker change, or next step."
        />
      </div>
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={isSaving}
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isSaving ? "Saving..." : "Add note"}
      </button>
    </form>
  );
}

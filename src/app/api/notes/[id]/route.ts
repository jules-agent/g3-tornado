import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: noteId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get the note + its task info
  const { data: note, error: noteError } = await serviceClient
    .from("task_notes")
    .select("id, task_id, created_by, created_at")
    .eq("id", noteId)
    .single();

  if (noteError || !note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();

  const isAdmin =
    profile?.role === "admin" || profile?.email === "ben@unpluggedperformance.com";

  if (isAdmin) {
    // Admins can delete any note
    await serviceClient.from("task_notes").delete().eq("id", noteId);
    return NextResponse.json({ ok: true });
  }

  // Non-admin: must be the note author
  if (note.created_by !== user.id) {
    return NextResponse.json(
      { error: "You can only delete your own notes" },
      { status: 403 }
    );
  }

  // Non-admin: check if task has multiple owners (shared task)
  const { data: taskOwners } = await serviceClient
    .from("task_owners")
    .select("owner_id")
    .eq("task_id", note.task_id);

  if (taskOwners && taskOwners.length > 1) {
    return NextResponse.json(
      { error: "Cannot delete notes on shared tasks with multiple owners" },
      { status: 403 }
    );
  }

  // All checks passed — delete
  await serviceClient.from("task_notes").delete().eq("id", noteId);
  return NextResponse.json({ ok: true });
}

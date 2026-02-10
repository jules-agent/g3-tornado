import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email, owner_id")
    .eq("id", user.id)
    .single();

  const isAdmin =
    profile?.role === "admin" || profile?.email === "ben@unpluggedperformance.com";

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get task owners
  const { data: taskOwners } = await serviceClient
    .from("task_owners")
    .select("owner_id")
    .eq("task_id", taskId);

  const ownerIds = (taskOwners || []).map((to) => to.owner_id);

  if (!isAdmin) {
    // Non-admin: can only delete if task has 1 or fewer owners
    // (i.e., not shared with multiple people)
    if (ownerIds.length > 1) {
      return NextResponse.json(
        { error: "Cannot delete a shared task with multiple owners. Remove yourself or ask an admin." },
        { status: 403 }
      );
    }

    // Must be an owner of the task (or task has no owners)
    if (ownerIds.length === 1 && profile?.owner_id !== ownerIds[0]) {
      return NextResponse.json(
        { error: "You can only delete your own tasks" },
        { status: 403 }
      );
    }
  }

  // Delete related records first
  await serviceClient.from("task_notes").delete().eq("task_id", taskId);
  await serviceClient.from("task_owners").delete().eq("task_id", taskId);

  // Delete the task
  const { error } = await serviceClient.from("tasks").delete().eq("id", taskId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

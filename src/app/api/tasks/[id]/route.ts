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

  // Admin-only
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();

  const isAdmin =
    profile?.role === "admin" || profile?.email === "ben@unpluggedperformance.com";

  if (!isAdmin) {
    return NextResponse.json(
      { error: "Only admins can delete tasks" },
      { status: 403 }
    );
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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

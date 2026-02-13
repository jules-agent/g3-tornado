import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/app/api/gigatron/_helpers";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(true);
  if ("error" in auth) return auth.error;

  const supabase = await createServerClient();
  const user = auth.user;

  const { userId, action } = await req.json();
  if (!userId || !["pause", "void", "activate"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Prevent self-action
  if (userId === user.id) {
    return NextResponse.json({ error: "Cannot change your own status" }, { status: 400 });
  }

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const newStatus = action === "activate" ? "active" : action === "pause" ? "paused" : "voided";

  // Update profile status
  const { error: profileError } = await serviceClient
    .from("profiles")
    .update({ status: newStatus })
    .eq("id", userId);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Ban/unban user in auth
  if (action === "pause" || action === "void") {
    // Ban for ~100 years
    const { error: banError } = await serviceClient.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
    });
    if (banError) {
      return NextResponse.json({ error: banError.message }, { status: 500 });
    }
  } else if (action === "activate") {
    // Unban
    const { error: unbanError } = await serviceClient.auth.admin.updateUserById(userId, {
      ban_duration: "none",
    });
    if (unbanError) {
      return NextResponse.json({ error: unbanError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, status: newStatus });
}

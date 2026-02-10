import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

// Start impersonation — sets cookie so server components pick it up
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && user.email !== "ben@unpluggedperformance.com") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { targetUserId } = await request.json();
  if (!targetUserId) return NextResponse.json({ error: "Target user ID required" }, { status: 400 });

  const { data: targetUser } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", targetUserId)
    .single();

  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  const { error } = await supabase
    .from("impersonation_sessions")
    .insert({
      admin_id: user.id,
      target_user_id: targetUserId,
      token,
      expires_at: expiresAt.toISOString(),
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Set cookie for server-side detection
  const cookieStore = await cookies();
  cookieStore.set("impersonation_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 3600,
    path: "/",
  });

  return NextResponse.json({
    success: true,
    token,
    targetUser: {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.full_name,
    },
  });
}

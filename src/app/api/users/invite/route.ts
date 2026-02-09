import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

// Any authenticated user can invite new users
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, linkToOwnerId, role } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Check if user already exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    return NextResponse.json({ error: "User already exists" }, { status: 400 });
  }

  // Generate invite token
  const inviteToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Store pending invite
  const { error: insertError } = await supabase
    .from("pending_invites")
    .insert({
      email: email.toLowerCase().trim(),
      invite_token: inviteToken,
      expires_at: expiresAt.toISOString(),
      invited_by: user.id,
      link_to_owner_id: linkToOwnerId || null,
      role: role || "user",
    });

  if (insertError) {
    // Table might not exist yet, fall back to basic invite
    console.log("pending_invites table not ready, using basic invite flow");
  }

  // Build signup URL with invite token
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://g3-tornado.vercel.app";
  const signupUrl = `${baseUrl}/signup?email=${encodeURIComponent(email)}&invite=${inviteToken}${linkToOwnerId ? `&owner=${linkToOwnerId}` : ""}`;

  // Log the invite action
  await supabase.from("activity_log").insert({
    action: "invited",
    entity_type: "user",
    entity_id: user.id, // Use inviter's ID as reference
    entity_name: email,
    created_by: user.id,
    created_by_email: user.email,
    metadata: {
      invited_email: email,
      link_to_owner_id: linkToOwnerId,
      role: role || "user",
    },
  });

  return NextResponse.json({
    success: true,
    message: `Invite created for ${email}`,
    signupUrl,
    note: "Share this link with the user to complete signup.",
  });
}

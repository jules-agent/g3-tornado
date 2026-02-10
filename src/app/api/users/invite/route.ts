import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { sendInviteEmail } from "@/lib/email";

// Any authenticated user can invite new users
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, linkToOwnerId, role, resend: isResend } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Check if user already exists (skip for resend)
  if (!isResend) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }
  }

  // Generate invite token
  const inviteToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  if (isResend) {
    // For resend: update existing pending invite with new token
    await supabase
      .from("pending_invites")
      .update({
        invite_token: inviteToken,
        expires_at: expiresAt.toISOString(),
        invited_by: user.id,
      })
      .eq("email", email.toLowerCase().trim());
  } else {
    // Store new pending invite
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
      console.log("pending_invites insert error:", insertError);
    }
  }

  // Build signup URL with invite token
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.g3tornado.com";
  const signupUrl = `${baseUrl}/signup?email=${encodeURIComponent(email)}&invite=${inviteToken}${linkToOwnerId ? `&owner=${linkToOwnerId}` : ""}`;

  // Send invite email
  let emailSent = false;
  let emailError = "";
  
  if (process.env.SMTP_USER || process.env.RESEND_API_KEY) {
    const result = await sendInviteEmail({
      to: email,
      signupUrl,
      invitedByEmail: user.email || undefined,
      role: role || "user",
    });
    emailSent = result.success;
    if (!result.success) {
      emailError = result.error || "Unknown email error";
    }
  } else {
    emailError = "Email service not configured";
  }

  // Log the invite action
  await supabase.from("activity_log").insert({
    action: isResend ? "resent_invite" : "invited",
    entity_type: "user",
    entity_id: user.id,
    entity_name: email,
    created_by: user.id,
    created_by_email: user.email,
    metadata: {
      invited_email: email,
      link_to_owner_id: linkToOwnerId,
      role: role || "user",
      email_sent: emailSent,
    },
  });

  return NextResponse.json({
    success: true,
    emailSent,
    emailError: emailError || undefined,
    message: emailSent 
      ? `✅ Invitation email sent to ${email}` 
      : `⚠️ Invite created but email failed: ${emailError}. Share the link manually.`,
    signupUrl,
  });
}

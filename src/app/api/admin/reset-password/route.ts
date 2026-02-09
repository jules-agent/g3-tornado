import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  // Check if requester is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== "ben@unpluggedperformance.com") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { userId, action } = await request.json();

  if (!userId || !action) {
    return NextResponse.json({ error: "Missing userId or action" }, { status: 400 });
  }

  // Get user's email for the reset
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (action === "send_email") {
    // Send password reset email via Supabase Auth
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.g3tornado.com'}/auth/reset-password`,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Password reset email sent" });
  } else if (action === "manual_reset") {
    // Generate a temporary password
    const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!${Date.now().toString().slice(-4)}`;

    // Use Supabase Admin API to update the user's password
    const supabaseAdmin = await import("@supabase/supabase-js").then((mod) =>
      mod.createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      )
    );

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      tempPassword,
      message: "Password reset successfully" 
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

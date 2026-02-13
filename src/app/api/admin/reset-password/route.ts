import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/gigatron/_helpers";

export async function POST(request: Request) {
  const auth = await requireAuth(true);
  if ("error" in auth) return auth.error;

  const supabase = await createClient();

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
      redirectTo: "https://www.g3tornado.com/auth/reset-password",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Password reset email sent to ${profile.email}` });
  } else if (action === "manual_reset") {
    // Check if service role key is available
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ 
        error: "Service role key not configured. Please add SUPABASE_SERVICE_ROLE_KEY to environment variables." 
      }, { status: 500 });
    }

    // Generate a temporary password
    const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!${Date.now().toString().slice(-4)}`;

    // Use Supabase Admin API to update the user's password
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
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

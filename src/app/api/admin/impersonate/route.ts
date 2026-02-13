import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAuth } from "@/app/api/gigatron/_helpers";

// Start impersonation session
export async function POST(request: Request) {
  const auth = await requireAuth(true);
  if ("error" in auth) return auth.error;

  const supabase = await createClient();
  const user = auth.user;

  const { targetUserId } = await request.json();
  
  if (!targetUserId) {
    return NextResponse.json({ error: "Target user ID required" }, { status: 400 });
  }

  // Check target user exists
  const { data: targetUser } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", targetUserId)
    .single();

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Create impersonation token
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

  if (error) {
    console.error("Failed to create impersonation session:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log the impersonation
  await supabase.from("activity_log").insert({
    action: "impersonated",
    entity_type: "user",
    entity_id: targetUserId,
    entity_name: targetUser.full_name || targetUser.email,
    created_by: user.id,
    created_by_email: user.email,
    metadata: { 
      admin_email: user.email,
      target_email: targetUser.email 
    },
  });

  return NextResponse.json({ 
    success: true, 
    token,
    targetUser: {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.full_name,
    }
  });
}

// End impersonation session
export async function DELETE(request: Request) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (token) {
    // End specific session
    await supabase
      .from("impersonation_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("token", token);
  } else {
    // End all active sessions for this admin
    await supabase
      .from("impersonation_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("admin_id", user.id)
      .is("ended_at", null);
  }

  return NextResponse.json({ success: true });
}

// Get current impersonation status
export async function GET() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check for active impersonation session
  const { data: session } = await supabase
    .from("impersonation_sessions")
    .select(`
      id,
      token,
      expires_at,
      target_user:profiles!impersonation_sessions_target_user_id_fkey(id, email, full_name)
    `)
    .eq("admin_id", user.id)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ isImpersonating: false });
  }

  return NextResponse.json({
    isImpersonating: true,
    token: session.token,
    targetUser: session.target_user,
    expiresAt: session.expires_at,
  });
}

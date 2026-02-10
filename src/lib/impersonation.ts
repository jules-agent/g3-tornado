import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Get the effective user for the current request.
 * If an admin is impersonating, returns the target user's profile.
 * Otherwise returns the authenticated user's profile.
 */
export async function getEffectiveUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Check for impersonation cookie
  const cookieStore = await cookies();
  const impersonationToken = cookieStore.get("impersonation_token")?.value;

  if (impersonationToken) {
    // Validate the token
    const { data: session } = await supabase
      .from("impersonation_sessions")
      .select("target_user_id, admin_id, expires_at, ended_at")
      .eq("token", impersonationToken)
      .maybeSingle();

    if (
      session &&
      session.admin_id === user.id &&
      !session.ended_at &&
      new Date(session.expires_at) > new Date()
    ) {
      // Valid impersonation — fetch target user's profile
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, owner_id")
        .eq("id", session.target_user_id)
        .maybeSingle();

      if (targetProfile) {
        return {
          authUser: user,
          effectiveUserId: session.target_user_id,
          email: targetProfile.email,
          fullName: targetProfile.full_name,
          role: targetProfile.role || "user",
          ownerId: targetProfile.owner_id,
          isImpersonating: true,
          realAdminId: user.id,
        };
      }
    }
  }

  // Normal user — no impersonation
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, owner_id")
    .eq("id", user.id)
    .maybeSingle();

  return {
    authUser: user,
    effectiveUserId: user.id,
    email: profile?.email ?? user.email ?? null,
    fullName: profile?.full_name ?? null,
    role: profile?.role ?? "user",
    ownerId: profile?.owner_id ?? null,
    isImpersonating: false,
    realAdminId: null,
  };
}

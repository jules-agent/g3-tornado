import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Require authenticated Supabase session.
 * Returns { user, profile } or a NextResponse error.
 */
export async function requireAuth(adminOnly = false) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (adminOnly) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
  }

  return { user };
}

/** Forward search params from the incoming request as a plain object */
export function extractParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const searchParams = new URL(url).searchParams;
  searchParams.forEach((v, k) => {
    params[k] = v;
  });
  return params;
}

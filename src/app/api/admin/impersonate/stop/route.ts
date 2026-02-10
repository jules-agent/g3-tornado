import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieStore = await cookies();
  const token = cookieStore.get("impersonation_token")?.value;

  if (token) {
    await supabase
      .from("impersonation_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("token", token);
  }

  // Clear the cookie
  cookieStore.delete("impersonation_token");

  return NextResponse.json({ success: true });
}

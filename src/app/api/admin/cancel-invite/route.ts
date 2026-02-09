import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && user.email !== "ben@unpluggedperformance.com") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { inviteId } = await request.json();
  if (!inviteId) {
    return NextResponse.json({ error: "inviteId required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("pending_invites")
    .delete()
    .eq("id", inviteId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

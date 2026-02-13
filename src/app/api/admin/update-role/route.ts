import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/gigatron/_helpers";

export async function POST(request: Request) {
  const auth = await requireAuth(true);
  if ("error" in auth) return auth.error;

  const supabase = await createClient();

  const { userId, role } = await request.json();

  if (!userId || !role) {
    return NextResponse.json({ error: "Missing userId or role" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/gigatron/_helpers";

export async function POST(request: Request) {
  const auth = await requireAuth(true);
  if ("error" in auth) return auth.error;

  const supabase = await createClient();

  const { userId, ownerId } = await request.json();
  
  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ owner_id: ownerId })
    .eq("id", userId);

  if (error) {
    console.error("Failed to link owner:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

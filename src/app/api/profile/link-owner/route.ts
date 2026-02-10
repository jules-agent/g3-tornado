import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { owner_id } = await request.json();
  if (!owner_id) return NextResponse.json({ error: "owner_id required" }, { status: 400 });

  // Update the user's profile to link to the owner
  const { error } = await supabase
    .from("profiles")
    .update({ owner_id })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

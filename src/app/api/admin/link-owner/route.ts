import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  
  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email !== "ben@unpluggedperformance.com") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

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

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  // Check if user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email !== "ben@unpluggedperformance.com") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

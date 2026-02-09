import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Get all owners (any authenticated user)
export async function GET() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: owners, error } = await supabase
    .from("owners")
    .select("*")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ owners });
}

// Create new owner (any authenticated user - distributed creation)
export async function POST(request: Request) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, email, phone, is_internal } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Owner name is required" }, { status: 400 });
  }

  const { data: owner, error } = await supabase
    .from("owners")
    .insert({
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      is_internal: is_internal ?? true,
      created_by: user.id,
      created_by_email: user.email,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Owner with this name already exists" }, { status: 409 });
    }
    console.error("Failed to create owner:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Activity log is handled by trigger

  return NextResponse.json({ owner });
}

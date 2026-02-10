import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" || user.email === "ben@unpluggedperformance.com";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  // All authenticated users can create projects
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, is_up, is_bp, is_upfit, visibility } = await request.json();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      description,
      is_up: is_up || false,
      is_bp: is_bp || false,
      is_upfit: is_upfit || false,
      visibility: visibility || "shared",
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  if (!(await checkAdmin(supabase))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, description, is_up, is_bp, is_upfit } = await request.json();
  if (!id || !name) return NextResponse.json({ error: "ID and name are required" }, { status: 400 });

  const { data, error } = await supabase
    .from("projects")
    .update({ name, description, is_up: is_up || false, is_bp: is_bp || false, is_upfit: is_upfit || false })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  if (!(await checkAdmin(supabase))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  // Only allow specific fields
  const allowed = ["is_up", "is_bp", "is_upfit", "name", "description"];
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (allowed.includes(k)) filtered[k] = v;
  }

  const { data, error } = await supabase.from("projects").update(filtered).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  if (!(await checkAdmin(supabase))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

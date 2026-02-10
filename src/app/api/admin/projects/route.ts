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

  const { name, description, is_up, is_bp, is_upfit, visibility, one_on_one_owner_id } = await request.json();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // Ensure profile exists (foreign key constraint)
  await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email || "",
    full_name: user.user_metadata?.full_name || user.email || "",
  }, { onConflict: "id", ignoreDuplicates: true });

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
      one_on_one_owner_id: one_on_one_owner_id || null,
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = await checkAdmin(supabase);

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  // Check if user is admin OR the project creator
  if (!isAdmin) {
    const { data: project } = await supabase.from("projects").select("created_by").eq("id", id).single();
    if (!project || project.created_by !== user.id) {
      return NextResponse.json({ error: "Only the project creator or an admin can edit this project" }, { status: 403 });
    }
  }

  // Only allow specific fields — non-admins can only edit name and description
  const adminOnly = ["is_up", "is_bp", "is_upfit", "visibility", "deadline", "buffer_days", "customer_name"];
  const allowed = isAdmin
    ? ["name", "description", ...adminOnly]
    : ["name", "description"];
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

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { isAdmin: false, user: null };
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  
  const isAdmin = profile?.role === "admin" || user.email === "ben@unpluggedperformance.com";
  return { isAdmin, user };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { isAdmin, user } = await checkAdmin(supabase);

  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, email, phone } = await request.json();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("owners")
    .insert({ 
      name, 
      email, 
      phone,
      created_by: user.id,
      created_by_email: user.email,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { isAdmin, user } = await checkAdmin(supabase);

  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, name, email, phone } = await request.json();

  if (!id || !name) {
    return NextResponse.json({ error: "ID and name are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("owners")
    .update({ name, email, phone })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log the update
  await supabase.from("activity_log").insert({
    action: "updated",
    entity_type: "owner",
    entity_id: id,
    entity_name: name,
    created_by: user.id,
    created_by_email: user.email,
  });

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { isAdmin, user } = await checkAdmin(supabase);

  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  // Get owner name for logging
  const { data: owner } = await supabase
    .from("owners")
    .select("name")
    .eq("id", id)
    .single();

  // First remove owner from all tasks
  await supabase.from("task_owners").delete().eq("owner_id", id);

  // Then delete the owner
  const { error } = await supabase.from("owners").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log the deletion
  await supabase.from("activity_log").insert({
    action: "deleted",
    entity_type: "owner",
    entity_id: id,
    entity_name: owner?.name || "Unknown",
    created_by: user.id,
    created_by_email: user.email,
  });

  return NextResponse.json({ success: true });
}

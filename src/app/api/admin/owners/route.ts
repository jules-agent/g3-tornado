import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email === "ben@unpluggedperformance.com";
}

export async function POST(request: Request) {
  const supabase = await createClient();

  if (!(await checkAdmin(supabase))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, email } = await request.json();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("owners")
    .insert({ name, email })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const supabase = await createClient();

  if (!(await checkAdmin(supabase))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, name, email } = await request.json();

  if (!id || !name) {
    return NextResponse.json({ error: "ID and name are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("owners")
    .update({ name, email })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();

  if (!(await checkAdmin(supabase))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  // First remove owner from all tasks
  await supabase.from("task_owners").delete().eq("owner_id", id);

  // Then delete the owner
  const { error } = await supabase.from("owners").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

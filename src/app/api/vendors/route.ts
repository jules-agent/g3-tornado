import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Get all vendors
export async function GET() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: vendors, error } = await supabase
    .from("vendors")
    .select("*")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ vendors });
}

// Create new vendor (any authenticated user)
export async function POST(request: Request) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, email, phone, company, notes } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
  }

  const { data: vendor, error } = await supabase
    .from("vendors")
    .insert({
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      company: company?.trim() || null,
      notes: notes?.trim() || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Vendor with this name already exists" }, { status: 409 });
    }
    console.error("Failed to create vendor:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ vendor });
}

// Update vendor (admin only)
export async function PUT(request: Request) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id, name, email, phone, company, notes } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "Vendor ID is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("vendors")
    .update({
      name: name?.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      company: company?.trim() || null,
      notes: notes?.trim() || null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// Delete vendor (admin only)
export async function DELETE(request: Request) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Vendor ID is required" }, { status: 400 });
  }

  // Get vendor name for logging
  const { data: vendor } = await supabase
    .from("vendors")
    .select("name")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("vendors")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log deletion
  await supabase.from("activity_log").insert({
    action: "deleted",
    entity_type: "vendor",
    entity_id: id,
    entity_name: vendor?.name || "Unknown",
    created_by: user.id,
    created_by_email: user.email,
  });

  return NextResponse.json({ success: true });
}

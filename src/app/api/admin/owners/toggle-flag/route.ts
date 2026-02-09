import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && user.email !== "ben@unpluggedperformance.com") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { ownerId, field, value } = await request.json();
  
  const allowedFields = ["is_up_employee", "is_bp_employee", "is_upfit_employee", "is_third_party_vendor"];
  if (!ownerId || !allowedFields.includes(field) || typeof value !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // If setting vendor=true, clear employee flags; if setting employee=true, clear vendor
  const updateData: Record<string, boolean> = { [field]: value };
  
  if (value && field === "is_third_party_vendor") {
    updateData.is_up_employee = false;
    updateData.is_bp_employee = false;
    updateData.is_upfit_employee = false;
  } else if (value && field !== "is_third_party_vendor") {
    updateData.is_third_party_vendor = false;
  }

  const { data, error } = await supabase
    .from("owners")
    .update(updateData)
    .eq("id", ownerId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

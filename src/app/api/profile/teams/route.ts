import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { owner_id, is_up_employee, is_bp_employee, is_upfit_employee, is_bpas_employee, is_third_party_vendor } = await request.json();

  // Check if user is admin
  const { data: profile } = await supabase.from("profiles").select("role, owner_id").eq("id", user.id).single();
  const isAdmin = profile?.role === "admin" || user.email === "ben@unpluggedperformance.com";

  // Verify the owner_id belongs to this user (or user is admin)
  if (!isAdmin && profile?.owner_id !== owner_id) {
    return NextResponse.json({ error: "Can only update your own teams" }, { status: 403 });
  }

  // Non-admins can only ADD flags, not remove them
  if (!isAdmin) {
    const { data: currentOwner } = await supabase.from("owners").select("is_up_employee, is_bp_employee, is_upfit_employee, is_bpas_employee, is_third_party_vendor").eq("id", owner_id).single();
    if (currentOwner) {
      // Prevent removing existing flags
      if (currentOwner.is_up_employee && !is_up_employee) return NextResponse.json({ error: "Only admins can remove team assignments" }, { status: 403 });
      if (currentOwner.is_bp_employee && !is_bp_employee) return NextResponse.json({ error: "Only admins can remove team assignments" }, { status: 403 });
      if (currentOwner.is_upfit_employee && !is_upfit_employee) return NextResponse.json({ error: "Only admins can remove team assignments" }, { status: 403 });
      if (currentOwner.is_bpas_employee && !is_bpas_employee) return NextResponse.json({ error: "Only admins can remove team assignments" }, { status: 403 });
      if (currentOwner.is_third_party_vendor && !is_third_party_vendor) return NextResponse.json({ error: "Only admins can remove team assignments" }, { status: 403 });
    }
  }

  const { error } = await supabase.from("owners").update({
    is_up_employee: is_up_employee || false,
    is_bp_employee: is_bp_employee || false,
    is_upfit_employee: is_upfit_employee || false,
    is_bpas_employee: is_bpas_employee || false,
    is_third_party_vendor: is_third_party_vendor || false,
  }).eq("id", owner_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

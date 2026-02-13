import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/gigatron/_helpers";

export async function POST(request: Request) {
  const auth = await requireAuth(true);
  if ("error" in auth) return auth.error;

  const supabase = await createClient();
  const user = auth.user;

  const { ownerId, field, value } = await request.json();
  
  const allowedFields = ["is_up_employee", "is_bp_employee", "is_upfit_employee", "is_bpas_employee", "is_third_party_vendor", "is_private"];
  if (!ownerId || !allowedFields.includes(field) || typeof value !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Vendors and employees are NOT mutually exclusive — vendors CAN have company associations
  const updateData: Record<string, boolean | string | null> = { [field]: value };
  
  // Handle is_private toggle
  if (field === "is_private") {
    if (value) {
      // Setting private to true - set private_owner_id to current admin user
      updateData.private_owner_id = user.id;
    } else {
      // Setting private to false - clear private_owner_id
      updateData.private_owner_id = null;
    }
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

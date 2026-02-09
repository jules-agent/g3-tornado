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

// Validate owner flags - third party vendor and employee flags are mutually exclusive
function validateOwnerFlags(data: {
  is_up_employee?: boolean;
  is_bp_employee?: boolean;
  is_upfit_employee?: boolean;
  is_third_party_vendor?: boolean;
}): { valid: boolean; error?: string } {
  const { is_up_employee, is_bp_employee, is_upfit_employee, is_third_party_vendor } = data;
  
  const isEmployee = is_up_employee || is_bp_employee || is_upfit_employee;
  
  if (is_third_party_vendor && isEmployee) {
    return {
      valid: false,
      error: "Cannot be both a third party vendor and an employee. Please uncheck one.",
    };
  }
  
  return { valid: true };
}

export async function GET() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: owners, error } = await supabase
    .from("owners")
    .select(`
      id,
      name,
      email,
      phone,
      is_up_employee,
      is_bp_employee,
      is_upfit_employee,
      is_third_party_vendor,
      created_by,
      created_by_email,
      created_at
    `)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ owners });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { isAdmin, user } = await checkAdmin(supabase);

  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { 
    name, 
    email, 
    phone,
    is_up_employee = false,
    is_bp_employee = false,
    is_upfit_employee = false,
    is_third_party_vendor = false,
  } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Validate flags
  const validation = validateOwnerFlags({
    is_up_employee,
    is_bp_employee,
    is_upfit_employee,
    is_third_party_vendor,
  });

  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("owners")
    .insert({ 
      name, 
      email: email || null, 
      phone: phone || null,
      is_up_employee,
      is_bp_employee,
      is_upfit_employee,
      is_third_party_vendor,
      created_by: user.id,
      created_by_email: user.email,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "An owner with this name already exists" }, { status: 409 });
    }
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

  const body = await request.json();
  const { 
    id, 
    name, 
    email, 
    phone,
    is_up_employee,
    is_bp_employee,
    is_upfit_employee,
    is_third_party_vendor,
  } = body;

  if (!id || !name) {
    return NextResponse.json({ error: "ID and name are required" }, { status: 400 });
  }

  // Validate flags
  const validation = validateOwnerFlags({
    is_up_employee,
    is_bp_employee,
    is_upfit_employee,
    is_third_party_vendor,
  });

  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Build update object
  const updateData: Record<string, unknown> = { 
    name, 
    email: email || null, 
    phone: phone || null,
  };

  // Only include flag fields if they're provided
  if (typeof is_up_employee === "boolean") updateData.is_up_employee = is_up_employee;
  if (typeof is_bp_employee === "boolean") updateData.is_bp_employee = is_bp_employee;
  if (typeof is_upfit_employee === "boolean") updateData.is_upfit_employee = is_upfit_employee;
  if (typeof is_third_party_vendor === "boolean") updateData.is_third_party_vendor = is_third_party_vendor;

  const { data, error } = await supabase
    .from("owners")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "An owner with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log the update with classification changes
  const classificationInfo: string[] = [];
  if (is_up_employee) classificationInfo.push("UP");
  if (is_bp_employee) classificationInfo.push("BP");
  if (is_upfit_employee) classificationInfo.push("UP.FIT");
  if (is_third_party_vendor) classificationInfo.push("3rd Party Vendor");

  await supabase.from("activity_log").insert({
    action: "updated",
    entity_type: "owner",
    entity_id: id,
    entity_name: name,
    created_by: user.id,
    created_by_email: user.email,
    metadata: {
      classification: classificationInfo.length > 0 ? classificationInfo : ["Unclassified"],
    },
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

  // Get owner details for logging
  const { data: owner } = await supabase
    .from("owners")
    .select("name, is_up_employee, is_bp_employee, is_upfit_employee, is_third_party_vendor")
    .eq("id", id)
    .single();

  // First remove owner from all tasks
  await supabase.from("task_owners").delete().eq("owner_id", id);

  // Then delete the owner
  const { error } = await supabase.from("owners").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log the deletion with classification info
  const classificationInfo: string[] = [];
  if (owner?.is_up_employee) classificationInfo.push("UP");
  if (owner?.is_bp_employee) classificationInfo.push("BP");
  if (owner?.is_upfit_employee) classificationInfo.push("UP.FIT");
  if (owner?.is_third_party_vendor) classificationInfo.push("3rd Party Vendor");

  await supabase.from("activity_log").insert({
    action: "deleted",
    entity_type: "owner",
    entity_id: id,
    entity_name: owner?.name || "Unknown",
    created_by: user.id,
    created_by_email: user.email,
    metadata: {
      classification: classificationInfo.length > 0 ? classificationInfo : ["Unclassified"],
    },
  });

  return NextResponse.json({ success: true });
}

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/gigatron/_helpers";

// Get activity log
export async function GET(request: Request) {
  const auth = await requireAuth(true);
  if ("error" in auth) return auth.error;

  const supabase = await createClient();

  const url = new URL(request.url);
  const entityType = url.searchParams.get("type"); // Filter by entity type
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  let query = supabase
    .from("activity_log")
    .select(`
      id,
      action,
      entity_type,
      entity_id,
      entity_name,
      created_by,
      created_by_email,
      metadata,
      created_at,
      creator:profiles!activity_log_created_by_fkey(id, email, full_name)
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (entityType) {
    query = query.eq("entity_type", entityType);
  }

  const { data: logs, error } = await query;

  if (error) {
    console.error("Failed to fetch activity log:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs });
}

// Delete entity and log the deletion
export async function DELETE(request: Request) {
  const auth = await requireAuth(true);
  if ("error" in auth) return auth.error;

  const supabase = await createClient();
  const user = auth.user;

  const { entityType, entityId, entityName } = await request.json();

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "Entity type and ID required" }, { status: 400 });
  }

  // Delete the entity based on type
  let deleteError = null;
  
  switch (entityType) {
    case "owner":
      // First remove owner from all tasks
      await supabase.from("task_owners").delete().eq("owner_id", entityId);
      
      const { error: ownerError } = await supabase
        .from("owners")
        .delete()
        .eq("id", entityId);
      deleteError = ownerError;
      break;
    case "vendor":
      // Vendors table has been deprecated - vendors are now stored in owners table
      // with is_third_party_vendor = true
      return NextResponse.json({ 
        error: "Vendors have been migrated to owners. Please manage vendors via the Owners tab." 
      }, { status: 400 });
    case "user":
      // Don't delete the profile, just log it
      // Actual user deletion requires admin key
      return NextResponse.json({ error: "User deletion requires Supabase admin access" }, { status: 400 });
    case "project":
      const { error: projectError } = await supabase
        .from("projects")
        .delete()
        .eq("id", entityId);
      deleteError = projectError;
      break;
    default:
      return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
  }

  if (deleteError) {
    console.error(`Failed to delete ${entityType}:`, deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Log the deletion
  await supabase.from("activity_log").insert({
    action: "deleted",
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName || "Unknown",
    created_by: user.id,
    created_by_email: user.email,
  });

  return NextResponse.json({ success: true });
}

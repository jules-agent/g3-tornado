import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// View preferences structure:
// {
//   desktop: { columns: [...] },
//   mobile: { columns: [...], scale: 1.0 }
// }

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("column_layout")
    .eq("id", user.id)
    .single();

  // Handle legacy format (array) vs new format (object with desktop/mobile)
  const stored = profile?.column_layout;
  let preferences = { desktop: null, mobile: null };
  
  if (stored) {
    if (Array.isArray(stored)) {
      // Legacy: migrate to new format
      preferences = { desktop: { columns: stored }, mobile: { columns: stored, scale: 1.0 } };
    } else {
      preferences = stored;
    }
  }

  return NextResponse.json({ preferences });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  
  // Support both old format (column_layout) and new format (device, columns, scale)
  let updateData;
  
  if (body.device && (body.columns || body.scale !== undefined)) {
    // New format: device-specific update
    // First get existing preferences
    const { data: profile } = await supabase
      .from("profiles")
      .select("column_layout")
      .eq("id", user.id)
      .single();
    
    const existing = profile?.column_layout || { desktop: null, mobile: null };
    
    // Merge with existing
    const devicePrefs = existing[body.device] || {};
    if (body.columns) devicePrefs.columns = body.columns;
    if (body.scale !== undefined) devicePrefs.scale = body.scale;
    existing[body.device] = devicePrefs;
    
    updateData = existing;
  } else if (body.column_layout) {
    // Legacy format
    updateData = body.column_layout;
  } else {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ column_layout: updateData })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to save preferences:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

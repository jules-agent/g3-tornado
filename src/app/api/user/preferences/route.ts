import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// View preferences structure (v2 - named profiles):
// {
//   profiles: { [id]: { id, name, columns, visibleColumns, scale } },
//   defaults: { desktop: profileId, mobile: profileId },
//   lastUsed: { desktop: profileId, mobile: profileId }
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

  const stored = profile?.column_layout;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let preferences: any = null;
  
  if (stored) {
    if (stored.profiles) {
      // Already v2 format
      preferences = stored;
    } else if (Array.isArray(stored)) {
      // Legacy v0: migrate to v2
      const defaultProfile = {
        id: 'default',
        name: 'Default',
        columns: stored,
        visibleColumns: stored.map((c: { id: string }) => c.id),
        scale: 100
      };
      preferences = {
        profiles: { default: defaultProfile },
        defaults: { desktop: 'default', mobile: 'default' },
        lastUsed: { desktop: 'default', mobile: 'default' }
      };
    } else if (stored.desktop || stored.mobile) {
      // Legacy v1: migrate to v2
      const defaultProfile = {
        id: 'default',
        name: 'Default',
        columns: stored.desktop?.columns || stored.mobile?.columns || [],
        visibleColumns: stored.desktop?.visibleColumns || stored.mobile?.visibleColumns || [],
        scale: stored.mobile?.scale || 100
      };
      preferences = {
        profiles: { default: defaultProfile },
        defaults: { desktop: 'default', mobile: 'default' },
        lastUsed: { desktop: 'default', mobile: 'default' }
      };
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
  
  let updateData;
  
  if (body.viewPreferences) {
    // v2 format: full view preferences object with named profiles
    updateData = body.viewPreferences;
  } else if (body.device && (body.columns || body.scale !== undefined || body.visibleColumns)) {
    // Legacy v1 format: device-specific update (migrate to v2)
    const { data: profile } = await supabase
      .from("profiles")
      .select("column_layout")
      .eq("id", user.id)
      .single();
    
    const existing = profile?.column_layout || { desktop: null, mobile: null };
    const devicePrefs = existing[body.device] || {};
    if (body.columns) devicePrefs.columns = body.columns;
    if (body.visibleColumns) devicePrefs.visibleColumns = body.visibleColumns;
    if (body.scale !== undefined) devicePrefs.scale = body.scale;
    existing[body.device] = devicePrefs;
    updateData = existing;
  } else if (body.column_layout) {
    // Legacy v0 format
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

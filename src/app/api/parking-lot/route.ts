import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";

/**
 * Helper: Get user from either cookie-based session or Authorization Bearer token.
 * This supports both web (cookies) and mobile (Bearer token) auth.
 */
async function getAuthUser(request?: NextRequest) {
  // Try cookie-based auth first (web app)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return { user, supabase };

  // Try Authorization header (mobile app)
  if (request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: { user: tokenUser } } = await serviceClient.auth.getUser(token);
      if (tokenUser) {
        return { user: tokenUser, supabase: serviceClient };
      }
    }
  }

  return { user: null, supabase };
}

export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("parking_lot")
    .select("*")
    .eq("created_by", user.id)
    .is("deleted_at", null)
    .is("spawned_task_id", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { description } = await request.json();
  if (!description?.trim()) return NextResponse.json({ error: "Description required" }, { status: 400 });

  // Use service client for insert to bypass RLS issues with token auth
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await serviceClient
    .from("parking_lot")
    .insert({ description: description.trim(), created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await serviceClient
    .from("parking_lot")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("created_by", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, spawned_task_id, description } = await request.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (spawned_task_id !== undefined) updates.spawned_task_id = spawned_task_id;
  if (description !== undefined) updates.description = description;

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await serviceClient
    .from("parking_lot")
    .update(updates)
    .eq("id", id)
    .eq("created_by", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

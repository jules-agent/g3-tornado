import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check if admin or the reporter
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.email === "ben@unpluggedperformance.com";

  // Get the bug report to check ownership
  const { data: report } = await serviceClient
    .from("bug_reports")
    .select("reported_by, status")
    .eq("id", id)
    .single();

  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isReporter = report.reported_by === user.id;

  // Reporters can only verify deployed fixes or reopen
  if (!isAdmin && isReporter) {
    const body = await request.json();
    // Reporter can: verify (deployed → fixed) or reject (deployed → pending)
    if (report.status !== "deployed") {
      return NextResponse.json({ error: "Can only verify deployed fixes" }, { status: 403 });
    }
    if (body.status !== "fixed" && body.status !== "pending") {
      return NextResponse.json({ error: "Invalid action" }, { status: 403 });
    }
    const updates: Record<string, unknown> = { status: body.status };
    if (body.status === "fixed") {
      updates.fixed_at = new Date().toISOString();
      updates.resolution = body.resolution || "Verified by reporter";
    }
    if (body.status === "pending") {
      updates.resolution = "Reporter: fix didn't work — reopened";
    }

    const { data, error } = await serviceClient
      .from("bug_reports")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Admin can update anything
  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.status) updates.status = body.status;
  if (body.resolution !== undefined) updates.resolution = body.resolution;
  if (body.status === "fixed") updates.fixed_at = new Date().toISOString();

  const { data, error } = await serviceClient
    .from("bug_reports")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

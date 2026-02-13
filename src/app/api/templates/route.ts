import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// GET: List templates (approved for all users, + own proposals, admins see ALL)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.email === "ben@unpluggedperformance.com";

  if (isAdmin) {
    // Admins see ALL templates (including other users' proposals) via service role
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await serviceClient
      .from("task_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Non-admins: Use service role to explicitly filter (approved + own proposals)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await serviceClient
    .from("task_templates")
    .select("*")
    .or(`status.eq.approved,created_by.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: Propose a new template
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, company_scope, gates } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Template name is required" }, { status: 400 });
  }
  if (!gates || !Array.isArray(gates) || gates.length === 0) {
    return NextResponse.json({ error: "At least one gate step is required" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .single();

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await serviceClient
    .from("task_templates")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      company_scope: company_scope || { is_up: false, is_bp: false, is_upfit: false, is_bpas: false },
      gates,
      created_by: user.id,
      created_by_email: profile?.email || user.email,
      status: "proposed",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

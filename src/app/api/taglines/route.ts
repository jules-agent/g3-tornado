import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: return list of blocked taglines
export async function GET() {
  const { data } = await supabaseAdmin
    .from("bug_reports")
    .select("description")
    .eq("type", "tagline_downvote")
    .neq("status", "rejected"); // admin override = status "rejected" (reject the downvote)

  const blocked = (data || []).map(r => r.description);
  return NextResponse.json({ blocked });
}

// POST: submit a thumbs down report
export async function POST(request: Request) {
  const body = await request.json();
  const { tagline, vote } = body;

  if (!tagline || vote !== "down") {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  // Get current user
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if already reported
  const { data: existing } = await supabaseAdmin
    .from("bug_reports")
    .select("id")
    .eq("type", "tagline_downvote")
    .eq("description", tagline)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: true, already: true });
  }

  await supabaseAdmin.from("bug_reports").insert({
    type: "tagline_downvote",
    description: tagline,
    status: "pending",
    reported_by: user.id,
    reported_by_email: user.email,
  });

  return NextResponse.json({ ok: true });
}

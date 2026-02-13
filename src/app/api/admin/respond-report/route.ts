import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/app/api/gigatron/_helpers";

export async function POST(request: Request) {
  const auth = await requireAuth(true);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { reportId, reportDescription, reporterEmail, response } = body;

    if (!reportId || !response) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Log the response for audit
    console.log(`[Admin Response] Report ${reportId}: ${response}`);
    console.log(`[Admin Response] Reporter: ${reporterEmail}`);
    console.log(`[Admin Response] Original: ${reportDescription}`);

    // The response is saved on the bug_report record (done client-side)
    // This endpoint exists for future webhook/notification integration

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Respond report error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

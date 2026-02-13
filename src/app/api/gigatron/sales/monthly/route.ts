import { NextRequest, NextResponse } from "next/server";
import { requireAuth, extractParams } from "../../_helpers";
import { getSalesMonthly } from "@/lib/gigatron-api";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(true);
  if ("error" in auth) return auth.error;

  try {
    const params = extractParams(request.url);
    const data = await getSalesMonthly(params.months ? parseInt(params.months) : undefined);
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

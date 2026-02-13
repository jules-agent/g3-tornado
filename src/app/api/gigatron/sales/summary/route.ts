import { NextResponse } from "next/server";
import { requireAuth } from "../../_helpers";
import { getSalesSummary } from "@/lib/gigatron-api";

export async function GET() {
  const auth = await requireAuth(true);
  if ("error" in auth) return auth.error;

  try {
    const data = await getSalesSummary();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

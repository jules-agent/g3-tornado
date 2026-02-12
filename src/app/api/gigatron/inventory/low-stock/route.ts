import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../_helpers";
import { getLowStock } from "@/lib/gigatron-api";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(true); // admin only
  if ("error" in auth) return auth.error;

  try {
    const threshold = new URL(request.url).searchParams.get("threshold");
    const data = await getLowStock(threshold ? Number(threshold) : undefined);
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

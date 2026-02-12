import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../_helpers";
import { getInventoryByPartId } from "@/lib/gigatron-api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ partId: string }> }
) {
  const auth = await requireAuth(true); // admin only
  if ("error" in auth) return auth.error;

  try {
    const { partId } = await params;
    const data = await getInventoryByPartId(Number(partId));
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

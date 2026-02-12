import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../_helpers";
import { getVendorById } from "@/lib/gigatron-api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const data = await getVendorById(Number(id));
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

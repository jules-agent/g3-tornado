import { NextRequest, NextResponse } from "next/server";
import { requireAuth, extractParams } from "../../../_helpers";
import { getCustomerOrders } from "@/lib/gigatron-api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(true); // admin only
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const qp = extractParams(request.url);
    const data = await getCustomerOrders(Number(id), qp);
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

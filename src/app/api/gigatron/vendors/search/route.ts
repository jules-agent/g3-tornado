import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../_helpers";
import { searchVendors } from "@/lib/gigatron-api";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const q = new URL(request.url).searchParams.get("q");
  if (!q) {
    return NextResponse.json({ error: "Missing q parameter" }, { status: 400 });
  }

  try {
    const data = await searchVendors(q);
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

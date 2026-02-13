import { NextResponse } from "next/server";
import { requireAuth } from "../../_helpers";
import { getCeoClose } from "@/lib/gigatron-api";

export async function GET() {
  const auth = await requireAuth(true);
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await getCeoClose());
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 502 });
  }
}

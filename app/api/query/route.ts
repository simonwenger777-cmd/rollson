import { NextResponse } from "next/server";
import { queryUpstream, warmupUpstream } from "../../../lib/upstream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

warmupUpstream();

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body" }, { status: 400 });
  }

  const cdKey =
    payload && typeof payload === "object" && "cdKey" in payload
      ? (payload as { cdKey?: unknown }).cdKey
      : undefined;

  if (typeof cdKey !== "string" || !cdKey.trim()) {
    return NextResponse.json({ ok: false, message: "Invalid request body" }, { status: 400 });
  }

  try {
    const data = await queryUpstream(cdKey.trim());
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, message: "Upstream error (network)" });
  }
}

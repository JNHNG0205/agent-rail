import { NextResponse } from "next/server";
import { proxy } from "@/lib/runtime";
import { ownerOf } from "@/lib/owner";

/// POST /api/runtime/agents/assistant — the caller's own client agent. Member 4.
///
/// Idempotent: returns the existing one, or creates and onboards a new one. The
/// browser calls it on sign-in, and a second assistant would mean a second USDC
/// balance and a split conversation.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const owner = await ownerOf(request);
  const result = await proxy("/agents/assistant", { method: "POST", body: {}, owner });
  return NextResponse.json(result.body, { status: result.status });
}

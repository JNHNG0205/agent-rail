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
  let owner: string | null;
  try {
    owner = await ownerOf(request);
  } catch {
    // The caller presented a token that did not hold up. Distinct from 403:
    // nothing is known about who they are, so signing in again is the fix.
    return NextResponse.json({ error: "sign in again" }, { status: 401 });
  }
  const result = await proxy("/agents/assistant", { method: "POST", body: {}, owner });
  return NextResponse.json(result.body, { status: result.status });
}

import { NextResponse } from "next/server";
import { proxy } from "@/lib/runtime";
import { ownerOf } from "@/lib/owner";

/// The agent runtime's directory — who exists and what they sell. Member 4.
///
/// Deliberately separate from /api/agents, which reports what the CHAIN has
/// recorded: identity token ids and registration blocks, from the indexer. This
/// route reports what the runtime is hosting right now — names, roles, prices
/// and graded terms, none of which exist on chain.
///
/// An agent can appear in one and not the other. A registration the runtime
/// does not host is an identity with nobody running it; an agent created here
/// appears in the indexed view only once the registration is indexed.
export const dynamic = "force-dynamic";

export async function GET() {
  const { status, body } = await proxy("/agents");
  return NextResponse.json(body, { status });
}

/// POST — create one. The runtime generates its key, derives the smart account,
/// funds it and registers it on chain before returning.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }
  let owner: string | null;
  try {
    owner = await ownerOf(request);
  } catch {
    // The caller presented a token that did not hold up. Distinct from 403:
    // nothing is known about who they are, so signing in again is the fix.
    return NextResponse.json({ error: "sign in again" }, { status: 401 });
  }
  const result = await proxy("/agents", { method: "POST", body, owner });
  return NextResponse.json(result.body, { status: result.status });
}

import { NextResponse } from "next/server";
import { proxy } from "@/lib/runtime";

/// GET /api/agents — the directory of agents a user has created. Member 4.
///
/// Distinct from /api/agents-indexed: this is who exists and what they sell,
/// read live from the runtime, where the indexed route reports what the chain
/// has recorded about them.
export const dynamic = "force-dynamic";

export async function GET() {
  const { status, body } = await proxy("/agents");
  return NextResponse.json(body, { status });
}

/// POST /api/agents — create one. The runtime generates its key, derives the
/// smart account, funds it and registers it on chain before returning.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }
  const result = await proxy("/agents", { method: "POST", body });
  return NextResponse.json(result.body, { status: result.status });
}

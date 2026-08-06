import { NextResponse } from "next/server";
import { proxy } from "@/lib/runtime";
import { ownerOf } from "@/lib/owner";

/// POST /api/runtime/agents/:id/hire — this agent finds a provider and commissions it.
/// Member 4.
///
/// Returns once the escrow is funded, not once the work is done. The provider
/// and the evaluator run on their own after that, and the job's progress shows
/// up through /api/jobs as the indexer records each step.
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
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
  const result = await proxy(`/agents/${encodeURIComponent(params.id)}/hire`, {
    method: "POST",
    body,
    owner,
  });
  return NextResponse.json(result.body, { status: result.status });
}

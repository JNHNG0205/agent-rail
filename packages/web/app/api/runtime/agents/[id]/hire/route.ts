import { NextResponse } from "next/server";
import { proxy } from "@/lib/runtime";

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
  const result = await proxy(`/agents/${encodeURIComponent(params.id)}/hire`, {
    method: "POST",
    body,
  });
  return NextResponse.json(result.body, { status: result.status });
}

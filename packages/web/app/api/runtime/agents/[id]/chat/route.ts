import { NextResponse } from "next/server";
import { proxy } from "@/lib/runtime";
import { ownerOf } from "@/lib/owner";

/// POST /api/runtime/agents/:id/chat — talk to one of your agents. Member 4.
///
/// The conversation is stateless: the whole history goes with each turn, so the
/// browser owns it and a runtime restart loses nothing.
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
  const owner = await ownerOf(request);
  const result = await proxy(`/agents/${encodeURIComponent(params.id)}/chat`, {
    method: "POST",
    body,
  });
  return NextResponse.json(result.body, { status: result.status });
}

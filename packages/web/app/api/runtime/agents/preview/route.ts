import { NextResponse } from "next/server";
import { proxy } from "@/lib/runtime";

/// POST /api/runtime/agents/preview — propose a service from a plain-language
/// purpose, without creating anything. Member 4.
///
/// Separate from creation on purpose: an identity registration is soulbound and
/// cannot be undone, so a person should see the terms their agent will be held
/// to while they can still change them.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }
  const result = await proxy("/agents/preview", { method: "POST", body });
  return NextResponse.json(result.body, { status: result.status });
}

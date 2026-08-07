import { NextResponse } from "next/server";
import { proxy } from "@/lib/runtime";

/// GET /api/runtime/treasury — where a creation fee is paid to.
///
/// Proxied from the runtime rather than configured here, so the address comes
/// from the key that will actually receive it. A copy in this package's env
/// would be a way to send money to an address nobody holds.

export const dynamic = "force-dynamic";

export async function GET() {
  const { status, body } = await proxy("/treasury");
  return NextResponse.json(body, { status });
}

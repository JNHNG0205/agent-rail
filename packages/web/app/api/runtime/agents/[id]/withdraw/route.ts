import { NextResponse } from "next/server";
import { proxy } from "@/lib/runtime";
import { NoVerifiedWalletError, UnauthorizedError, ownerOf, verifiedWalletsOf } from "@/lib/owner";

/// POST /api/runtime/agents/:id/withdraw — take an agent's earnings out. Member 4.
///
/// Two separate questions, and both must be answered before anything moves.
///
/// May this caller act as this agent? Settled by the access token, as with chat
/// and hire — the runtime re-checks it.
///
/// Where may the money go? Only to a wallet Privy has signed for. The request
/// names a destination, but naming it is not enough: an address in a request
/// body is whatever the page sent, and a transfer cannot be undone. It is
/// matched against the wallets in the caller's verified identity token, and
/// anything else is refused — including a valid address belonging to someone
/// else, which is exactly what a swapped field would look like.
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  // Who is asking, before anything else. An anonymous caller has no business
  // learning what this endpoint accepts.
  let owner: string | null;
  try {
    owner = await ownerOf(request);
  } catch {
    return NextResponse.json({ error: "sign in again" }, { status: 401 });
  }
  if (!owner) {
    // Anonymous callers may read the marketplace; they may not move money.
    return NextResponse.json({ error: "sign in to withdraw" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const { to, amountUsdc } = body as { to?: unknown; amountUsdc?: unknown };
  if (typeof to !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(to)) {
    return NextResponse.json({ error: "to must be an address" }, { status: 400 });
  }
  if (typeof amountUsdc !== "string" || amountUsdc.length === 0) {
    return NextResponse.json({ error: "amountUsdc is required" }, { status: 400 });
  }

  let wallets;
  try {
    wallets = await verifiedWalletsOf(request);
  } catch (err) {
    if (err instanceof NoVerifiedWalletError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "sign in again" }, { status: 401 });
    }
    throw err;
  }

  const permitted = wallets.some((w) => w.address === to.toLowerCase());
  if (!permitted) {
    // Deliberately says which wallets are allowed rather than only refusing:
    // the usual cause is a person with no linked wallet, and "not linked to your
    // account" is actionable where "forbidden" is not.
    return NextResponse.json(
      {
        error:
          wallets.length === 0
            ? "no wallet is linked to your account — link one in your wallet menu first"
            : "that address is not linked to your account",
      },
      { status: 403 },
    );
  }

  const result = await proxy(`/agents/${encodeURIComponent(params.id)}/withdraw`, {
    method: "POST",
    body: { to: to.toLowerCase(), amountUsdc },
    owner,
  });
  return NextResponse.json(result.body, { status: result.status });
}

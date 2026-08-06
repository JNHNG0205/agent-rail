import { NextResponse } from "next/server";
import { proxy } from "@/lib/runtime";
import { NoVerifiedWalletError, UnauthorizedError, ownerOf, verifiedWalletsOf } from "@/lib/owner";

/// POST /api/wallet/gas — enough ETH for the signed-in person to sign one
/// transfer. Member 4.
///
/// Depositing into an agent means signing an ERC-20 transfer from your own
/// wallet, and an embedded wallet created at sign-in has never held anything.
/// So the treasury pays for the first move.
///
/// This is a testnet faucet with a login in front of it. The destination is
/// checked against the wallets Privy signed for — not because sending gas to a
/// stranger is dangerous to the user, but because a faucet that funds any
/// address on request is a faucet that gets drained by a script.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let owner: string | null;
  try {
    owner = await ownerOf(request);
  } catch {
    return NextResponse.json({ error: "sign in again" }, { status: 401 });
  }
  if (!owner) {
    return NextResponse.json({ error: "sign in first" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const { to } = body as { to?: unknown };
  if (typeof to !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(to)) {
    return NextResponse.json({ error: "to must be an address" }, { status: 400 });
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

  if (!wallets.some((w) => w.address === to.toLowerCase())) {
    return NextResponse.json(
      {
        error:
          wallets.length === 0
            ? "no wallet is linked to your account"
            : "that address is not linked to your account",
      },
      { status: 403 },
    );
  }

  const result = await proxy("/wallet/gas", {
    method: "POST",
    body: { to: to.toLowerCase() },
    owner,
  });
  return NextResponse.json(result.body, { status: result.status });
}

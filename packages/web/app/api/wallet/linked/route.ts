import { NextResponse } from "next/server";
import { NoVerifiedWalletError, UnauthorizedError, ownerOf, verifiedWalletsOf } from "@/lib/owner";

/// GET /api/wallet/linked — the wallets Privy says this user has linked. Member 4.
///
/// The same list the withdrawal route checks a destination against, exposed so
/// the interface can offer a choice rather than assuming one. Privy's `user`
/// object in the browser carries only the first verified wallet, so a person who
/// linked their own external wallet had no way to reach it — the capability
/// existed on the server and nothing on screen could ask for it.
///
/// Read from the identity token, not from anything the page sent, so the list
/// offered is exactly the list that will be accepted.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let owner: string | null;
  try {
    owner = await ownerOf(request);
  } catch {
    return NextResponse.json({ error: "sign in again" }, { status: 401 });
  }
  if (!owner) {
    return NextResponse.json({ error: "sign in first" }, { status: 401 });
  }

  try {
    const wallets = await verifiedWalletsOf(request);
    return NextResponse.json({ wallets });
  } catch (err) {
    if (err instanceof NoVerifiedWalletError) {
      // Not an error the person can act on by retrying — it means identity
      // tokens are off, or they have linked no wallet at all.
      return NextResponse.json({ wallets: [], reason: err.message });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "sign in again" }, { status: 401 });
    }
    throw err;
  }
}

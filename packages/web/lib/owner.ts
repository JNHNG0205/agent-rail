import { verifyAccessToken } from "./privy";

/// Who this request is from.
///
/// The one place the caller's identity is established, so the rule lives in a
/// single file rather than in every route. A caller proves who they are with a
/// Privy access token; what the rest of the system receives is the resolved
/// string, which is why neither the routes nor the agent runtime changed when
/// this stopped being a header the browser simply asserted.
///
/// The identifier is Privy's DID rather than a wallet address. The access token
/// carries the DID and no wallet, so an address here would either be unverified
/// or need a second lookup — and the DID is the more stable of the two anyway:
/// one person may link several wallets, change them, or have none at all.

export class UnauthorizedError extends Error {}

function appId(): string {
  // Read per call, not at module load: a value captured at import time is
  // whatever the process started with, which makes tests depend on load order.
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

/// Resolve the caller, or throw if they presented something they could not back
/// up. Absent credentials are anonymous — plenty of the app is readable without
/// signing in — but a bad token is an error rather than a silent downgrade, so a
/// user whose session expired is told to sign in again instead of quietly
/// finding their own agents missing.
export async function ownerOf(request: Request): Promise<string | null> {
  const id = appId();

  if (!id) {
    // No Privy app configured — local development. The header is a claim with
    // nothing behind it, which is only acceptable because configuring Privy
    // turns it off. The check is on the app id FIRST, rather than a fallback
    // after verification fails: a fallback would let anyone skip verification
    // by sending a deliberately broken token alongside the header.
    const claimed = request.headers.get("x-agent-owner");
    return claimed && claimed.length > 0 ? claimed : null;
  }

  const token = bearerToken(request);
  if (!token) return null;

  try {
    return await verifyAccessToken(token, id);
  } catch (err) {
    throw new UnauthorizedError(err instanceof Error ? err.message : "invalid token");
  }
}

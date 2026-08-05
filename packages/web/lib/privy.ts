import { createPublicKey, verify as verifySignature, type JsonWebKey } from "node:crypto";

/// Verify a Privy access token, and answer who it belongs to.
///
/// The token is an ES256 JWT that Privy signs with a key it publishes. Checking
/// it needs the public half only, so this runs entirely here — no call to Privy
/// on the request path, and no app secret in the environment to leak.
///
/// Written against node:crypto rather than a JWT library on purpose: the whole
/// of it is a signature check and four claim comparisons, and a dependency that
/// parses attacker-controlled tokens is a poor thing to add without reading it.
///
/// What a valid token proves: Privy authenticated this user, and the user is a
/// user of THIS app. It does not prove which wallet they hold — the access token
/// carries the DID and nothing else, which is why the DID is what gets stored as
/// the owner.

const ISSUER = "privy.io";

/// Privy publishes the signing keys here. Public by design.
export function jwksUrlFor(appId: string): string {
  return `https://auth.privy.io/api/v1/apps/${appId}/jwks.json`;
}

interface JwtHeader {
  alg?: string;
  typ?: string;
  kid?: string;
}

interface JwtClaims {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  exp?: number;
  iat?: number;
}

export class TokenError extends Error {}

function decodeSegment(segment: string): unknown {
  // A JWT segment is base64url. Buffer's base64 decoder accepts it, but only
  // after the URL-safe characters are mapped back.
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(base64, "base64").toString("utf8")) as unknown;
}

/// Tolerance for the issuing clock running ahead of ours. Applied to iat only —
/// never to exp, where leeway would mean honouring a token past its expiry.
const CLOCK_SKEW_SECONDS = 60;

/// Check a token against a known set of keys and return its verified claims.
///
/// Separated from fetching so the rules can be tested against forged tokens
/// without a network. Throws rather than returning null: every rejection has a
/// distinct reason and losing it makes a failure impossible to diagnose.
///
/// Both Privy tokens are checked here. They differ only in what they carry —
/// the access token proves who is asking, the identity token also lists the
/// accounts they have linked — so the signature and claim rules must not be
/// written twice and drift apart.
export function verifyClaimsWithKeys(
  token: string,
  keys: JsonWebKey[],
  appId: string,
  nowSeconds: number,
): JwtClaims & Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new TokenError("not a JWT");
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];

  let header: JwtHeader;
  let claims: JwtClaims;
  try {
    header = decodeSegment(headerPart) as JwtHeader;
    claims = decodeSegment(payloadPart) as JwtClaims;
  } catch {
    throw new TokenError("malformed JWT");
  }

  // Pinned, not read from the token. Honouring the token's own choice is what
  // makes "alg": "none" work, and lets an HMAC token be verified using the
  // public key as its shared secret.
  if (header.alg !== "ES256") throw new TokenError(`unexpected alg ${header.alg}`);

  const candidates = header.kid
    ? keys.filter((k) => (k as { kid?: string }).kid === header.kid)
    : keys;
  if (candidates.length === 0) throw new TokenError("no key matches the token's kid");

  const signed = Buffer.from(`${headerPart}.${payloadPart}`, "utf8");
  const signature = Buffer.from(
    signaturePart.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  );

  // ES256 signatures are the raw r‖s pair, not the DER encoding OpenSSL assumes.
  const signatureValid = candidates.some((jwk) => {
    try {
      const key = createPublicKey({ key: jwk, format: "jwk" });
      return verifySignature("sha256", signed, { key, dsaEncoding: "ieee-p1363" }, signature);
    } catch {
      return false;
    }
  });
  if (!signatureValid) throw new TokenError("signature does not verify");

  // Everything below is only meaningful because the signature held.
  if (claims.iss !== ISSUER) throw new TokenError(`unexpected issuer ${claims.iss}`);

  // Without this, a valid token from any other Privy app authenticates here.
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(appId)) throw new TokenError("token was issued for another app");

  if (typeof claims.exp !== "number") throw new TokenError("token has no expiry");
  if (claims.exp <= nowSeconds) throw new TokenError("token has expired");
  if (typeof claims.iat === "number" && claims.iat > nowSeconds + CLOCK_SKEW_SECONDS) {
    throw new TokenError("token was issued in the future");
  }

  if (!claims.sub) throw new TokenError("token has no subject");
  return claims as JwtClaims & Record<string, unknown>;
}

/// The user's DID from an access token.
export function verifyWithKeys(
  token: string,
  keys: JsonWebKey[],
  appId: string,
  nowSeconds: number,
): string {
  return verifyClaimsWithKeys(token, keys, appId, nowSeconds).sub!;
}

/// A wallet the identity token says this user has linked.
///
/// Only wallets, and only their addresses. An identity token also carries
/// emails, social accounts and custom metadata; none of that belongs in a
/// withdrawal decision, and reading less means less to get wrong.
export interface LinkedWallet {
  address: `0x${string}`;
}

interface RawLinkedAccount {
  type?: unknown;
  address?: unknown;
  chain_type?: unknown;
}

/// Pull the linked wallets out of verified identity-token claims.
///
/// `linked_accounts` arrives as a JSON string rather than an array — a JWT
/// claim Privy stringifies — so it is parsed here and treated as untrusted
/// shape even though the signature held: a valid token may still contain an
/// account type this code has never seen.
export function linkedWallets(claims: Record<string, unknown>): LinkedWallet[] {
  const raw = claims.linked_accounts;
  let accounts: unknown;
  try {
    accounts = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  if (!Array.isArray(accounts)) return [];

  return accounts
    .filter((a): a is RawLinkedAccount => typeof a === "object" && a !== null)
    .filter((a) => a.type === "wallet" && (a.chain_type ?? "ethereum") === "ethereum")
    .map((a) => a.address)
    .filter((address): address is string => typeof address === "string")
    .filter((address) => /^0x[0-9a-fA-F]{40}$/.test(address))
    .map((address) => ({ address: address.toLowerCase() as `0x${string}` }));
}

interface CachedKeys {
  keys: JsonWebKey[];
  fetchedAt: number;
}

let cache: CachedKeys | undefined;
const CACHE_TTL_MS = 10 * 60 * 1000;

/// Privy's signing keys, cached. Fetching per request would put an outbound call
/// in front of every authenticated action, and make Privy's availability our own.
async function signingKeys(appId: string, force: boolean): Promise<JsonWebKey[]> {
  const fresh = cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (fresh && !force) return cache!.keys;

  const response = await fetch(jwksUrlFor(appId), { cache: "no-store" });
  if (!response.ok) {
    // Serving from a stale cache beats rejecting every user because one fetch
    // failed. The keys are long-lived; the cache being old is not a safety
    // problem, whereas a signature that does not verify is still rejected.
    if (cache) return cache.keys;
    throw new TokenError(`could not fetch signing keys (${response.status})`);
  }
  const body = (await response.json()) as { keys?: JsonWebKey[] };
  const keys = body.keys ?? [];
  cache = { keys, fetchedAt: Date.now() };
  return keys;
}

export function resetKeyCache(): void {
  cache = undefined;
}

/// Verify a token against Privy's published keys, returning its claims.
async function verifyAgainstPrivy(
  token: string,
  appId: string,
): Promise<JwtClaims & Record<string, unknown>> {
  const now = Math.floor(Date.now() / 1000);
  const keys = await signingKeys(appId, false);
  try {
    return verifyClaimsWithKeys(token, keys, appId, now);
  } catch (err) {
    // A rotated-in key is unknown until the cache expires, so one miss earns a
    // refetch. Only for key selection: a token that fails on its claims would
    // fail identically against fresh keys.
    if (err instanceof TokenError && err.message.includes("kid")) {
      return verifyClaimsWithKeys(token, await signingKeys(appId, true), appId, now);
    }
    throw err;
  }
}

/// The user's DID, from a verified access token.
export async function verifyAccessToken(token: string, appId: string): Promise<string> {
  return (await verifyAgainstPrivy(token, appId)).sub!;
}

/// The wallets a verified identity token says this user has linked.
///
/// This is the only acceptable source of a withdrawal destination. An address
/// taken from a request body is whatever the page sent — a typo, or a swap by
/// anything that can reach the browser — and a transfer cannot be undone.
export async function verifyIdentityToken(
  token: string,
  appId: string,
): Promise<{ userId: string; wallets: LinkedWallet[] }> {
  const claims = await verifyAgainstPrivy(token, appId);
  return { userId: claims.sub!, wallets: linkedWallets(claims) };
}

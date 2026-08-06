import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import { ownerOf, UnauthorizedError } from "./owner.js";
import { resetKeyCache } from "./privy.js";

/// How a request becomes an owner.
///
/// The rule this file exists to protect: once Privy is configured, the
/// x-agent-owner header stops meaning anything. Development keeps a way in that
/// needs no login, and the danger of such a door is that it stays open in the
/// place it was never meant to be — so that is what most of these test.

const APP_ID = "cmsfo82l901x60ckz2gtxq6vd";
const DID = "did:privy:cm4xyz00011122223333";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const JWK = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "ES256", use: "sig" };

function b64(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function token(claims: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: "ES256", typ: "JWT", kid: "k1" })}.${b64({
    iss: "privy.io",
    aud: APP_ID,
    sub: DID,
    iat: now - 10,
    exp: now + 3600,
    ...claims,
  })}`;
  const signer = createSign("sha256");
  signer.update(body);
  return `${body}.${signer.sign({ key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}

const realFetch = globalThis.fetch;

/// Serve our own key set in place of Privy's, so these run without a network and
/// without Privy's private key.
function stubJwks(): void {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ keys: [JWK] }), {
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  resetKeyCache();
}

function request(headers: Record<string, string>): Request {
  return new Request("https://agentrail.test/api/runtime/agents", { headers });
}

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  resetKeyCache();
});

test("with no Privy app configured, the header names the owner", () => {
  // Local development: no login, no Privy account needed to run the demo.
  delete process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  return ownerOf(request({ "x-agent-owner": "0xabc" })).then((owner) => {
    assert.equal(owner, "0xabc");
  });
});

test("configuring Privy turns the header off", async () => {
  // THE test. If this fails, the login is decorative: anyone can name any owner
  // and act as their agents, and every other check here is beside the point.
  process.env.NEXT_PUBLIC_PRIVY_APP_ID = APP_ID;
  stubJwks();
  assert.equal(await ownerOf(request({ "x-agent-owner": "did:privy:victim" })), null);
});

test("a header cannot override a verified token", async () => {
  // Both presented at once. The token wins, and the header is not consulted.
  process.env.NEXT_PUBLIC_PRIVY_APP_ID = APP_ID;
  stubJwks();
  const owner = await ownerOf(
    request({ authorization: `Bearer ${token()}`, "x-agent-owner": "did:privy:victim" }),
  );
  assert.equal(owner, DID);
});

test("a valid token resolves to its user", async () => {
  process.env.NEXT_PUBLIC_PRIVY_APP_ID = APP_ID;
  stubJwks();
  assert.equal(await ownerOf(request({ authorization: `Bearer ${token()}` })), DID);
});

test("a request with no credentials is anonymous, not an error", async () => {
  // Reading the marketplace does not require signing in.
  process.env.NEXT_PUBLIC_PRIVY_APP_ID = APP_ID;
  stubJwks();
  assert.equal(await ownerOf(request({})), null);
});

test("a bad token is rejected, not silently downgraded to anonymous", async () => {
  // Treating a failed check as "not signed in" would hide an expired session
  // behind an empty screen, and hide a forgery attempt entirely.
  process.env.NEXT_PUBLIC_PRIVY_APP_ID = APP_ID;
  stubJwks();
  await assert.rejects(
    () => ownerOf(request({ authorization: "Bearer not.a.token" })),
    UnauthorizedError,
  );
  await assert.rejects(
    () => ownerOf(request({ authorization: `Bearer ${token({ exp: 1 })}` })),
    UnauthorizedError,
  );
  await assert.rejects(
    () => ownerOf(request({ authorization: `Bearer ${token({ aud: "another-app" })}` })),
    UnauthorizedError,
  );
});

test("a malformed authorization header is anonymous, not an error", async () => {
  // Nothing was presented as a bearer token, so nothing failed to verify.
  process.env.NEXT_PUBLIC_PRIVY_APP_ID = APP_ID;
  stubJwks();
  for (const value of ["", "Bearer", "Basic abc", token()]) {
    assert.equal(await ownerOf(request({ authorization: value })), null, value.slice(0, 20));
  }
});

test("the scheme is matched case-insensitively", async () => {
  // Per RFC 7235; some clients send "bearer".
  process.env.NEXT_PUBLIC_PRIVY_APP_ID = APP_ID;
  stubJwks();
  assert.equal(await ownerOf(request({ authorization: `bearer ${token()}` })), DID);
});

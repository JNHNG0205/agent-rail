import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSign,
  createHmac,
  generateKeyPairSync,
  type JsonWebKey,
} from "node:crypto";
import { verifyWithKeys, TokenError, jwksUrlFor } from "./privy.js";

/// What a Privy token is allowed to prove.
///
/// This is the only thing standing between "anyone may claim to be anyone" and
/// an owner identity that means something, so the tests are written as forgeries
/// rather than as a happy path with variations. Each one is an attack that must
/// fail, and a test that passes because the token was malformed by accident
/// would be worthless — so every forgery below is a real, correctly-signed JWT
/// differing from a valid one in exactly the property under test.

const APP_ID = "cmsfo82l901x60ckz2gtxq6vd";
const DID = "did:privy:cm4xyz00011122223333";
const NOW = 1_800_000_000;

function keypair(kid: string) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid, alg: "ES256", use: "sig" };
  return { privateKey, jwk: jwk as JsonWebKey };
}

const PRIVY = keypair("privy-key-1");
const ATTACKER = keypair("privy-key-1"); // same kid, different key

function b64(value: unknown): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function mint(
  claims: Record<string, unknown>,
  options: { header?: Record<string, unknown>; key?: typeof PRIVY.privateKey } = {},
): string {
  const header = { alg: "ES256", typ: "JWT", kid: "privy-key-1", ...options.header };
  const body = `${b64(header)}.${b64(claims)}`;
  const signer = createSign("sha256");
  signer.update(body);
  const signature = signer.sign({
    key: options.key ?? PRIVY.privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${body}.${signature.toString("base64url")}`;
}

const VALID = {
  iss: "privy.io",
  aud: APP_ID,
  sub: DID,
  iat: NOW - 60,
  exp: NOW + 3600,
};

function verify(token: string, keys: JsonWebKey[] = [PRIVY.jwk]): string {
  return verifyWithKeys(token, keys, APP_ID, NOW);
}

test("a token Privy signed identifies its user", () => {
  assert.equal(verify(mint(VALID)), DID);
});

test("a token signed by anyone else is rejected", () => {
  // The whole point. Without the signature check, the claims below are simply
  // whatever the sender typed.
  assert.throws(
    () => verify(mint(VALID, { key: ATTACKER.privateKey })),
    (err: Error) => err instanceof TokenError && /signature/.test(err.message),
  );
});

test("a tampered subject invalidates the signature", () => {
  // Acting as someone else by editing the DID: the signature covers the payload,
  // so the edit has to break it.
  const token = mint(VALID);
  const [header, , signature] = token.split(".");
  const forged = `${header}.${b64({ ...VALID, sub: "did:privy:victim" })}.${signature}`;
  assert.throws(() => verify(forged), TokenError);
});

test("alg is pinned to ES256, not read from the token", () => {
  // "alg": "none" is the oldest JWT forgery there is, and it works whenever the
  // verifier believes the token about how it was signed.
  // Asserting the REASON, not merely that it threw: this code only ever runs an
  // ES256 verification, so an unsigned token is refused by the signature check
  // whether or not the alg is pinned. Matching on the message is what makes the
  // pin itself load-bearing — without it, this test passes for the wrong reason.
  const unsigned = `${b64({ alg: "none", typ: "JWT" })}.${b64(VALID)}.`;
  assert.throws(() => verify(unsigned), (err: Error) => /alg/.test(err.message));
});

test("a public key may not be used as an HMAC secret", () => {
  // The other half of algorithm confusion: sign HS256 using the published
  // public key as the shared secret, and a verifier that dispatches on the
  // token's alg accepts it. Rejected here because the alg is pinned first.
  const header = b64({ alg: "HS256", typ: "JWT", kid: "privy-key-1" });
  const payload = b64(VALID);
  const mac = createHmac("sha256", JSON.stringify(PRIVY.jwk))
    .update(`${header}.${payload}`)
    .digest("base64url");
  assert.throws(
    () => verify(`${header}.${payload}.${mac}`),
    (err: Error) => /alg/.test(err.message),
  );
});

test("a token for a different Privy app is rejected", () => {
  // Anyone can create their own Privy app and mint genuinely-signed tokens in
  // it. The audience is what keeps those out — and it is the check most easily
  // left out, because everything else about such a token is valid.
  assert.throws(
    () => verify(mint({ ...VALID, aud: "someone-elses-app" })),
    (err: Error) => /another app/.test(err.message),
  );
});

test("an expired token is rejected", () => {
  assert.throws(
    () => verify(mint({ ...VALID, exp: NOW - 1 })),
    (err: Error) => /expired/.test(err.message),
  );
  assert.equal(verify(mint({ ...VALID, exp: NOW + 1 })), DID);
});

test("a token with no expiry is rejected", () => {
  // Otherwise one leaked token is valid forever.
  const { exp: _exp, ...noExpiry } = VALID;
  assert.throws(() => verify(mint(noExpiry)), (err: Error) => /expiry/.test(err.message));
});

test("a token from another issuer is rejected", () => {
  assert.throws(
    () => verify(mint({ ...VALID, iss: "evil.example" })),
    (err: Error) => /issuer/.test(err.message),
  );
});

test("a token with no subject is rejected", () => {
  // An owner of "" would compare equal to nothing, but a null owner is treated
  // as anonymous elsewhere — better to refuse than to guess.
  const { sub: _sub, ...noSubject } = VALID;
  assert.throws(() => verify(mint(noSubject)), (err: Error) => /subject/.test(err.message));
});

test("the right key is chosen when Privy is rotating keys", () => {
  // The live app publishes two keys today. Verifying against the wrong one must
  // not fail the user, and a matching kid must not be taken on trust either.
  const older = keypair("privy-key-0");
  assert.equal(verify(mint(VALID), [older.jwk, PRIVY.jwk]), DID);
  assert.equal(verify(mint(VALID, { header: { kid: undefined } }), [older.jwk, PRIVY.jwk]), DID);
  assert.throws(() => verify(mint(VALID), [older.jwk]), (err: Error) => /kid/.test(err.message));
});

test("garbage is rejected rather than throwing something unexpected", () => {
  for (const junk of ["", "abc", "a.b", "a.b.c", "...", "x".repeat(500)]) {
    assert.throws(() => verify(junk), TokenError, `should reject ${JSON.stringify(junk)}`);
  }
});

test("the JWKS URL is built from the app id", () => {
  assert.equal(
    jwksUrlFor(APP_ID),
    `https://auth.privy.io/api/v1/apps/${APP_ID}/jwks.json`,
  );
});

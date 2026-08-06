import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import { isAuthorised, assertSafeToListen, host, secret } from "./auth.js";

/// The runtime's write endpoints spend a treasury's gas and an agent's USDC on
/// every call, so these are the checks between a reachable port and a drained
/// account. They are worth testing precisely because nothing about a missing
/// guard is visible until something is gone.

function req(headers: Record<string, string | string[]> = {}): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

beforeEach(() => {
  delete process.env.AGENT_RUNTIME_SECRET;
  delete process.env.AGENT_RUNTIME_HOST;
});

test("without a secret configured, any request passes", () => {
  // Only reachable on loopback — assertSafeToListen is what guarantees that, so
  // local development needs no ceremony.
  assert.equal(isAuthorised(req()), true);
});

test("with a secret configured, a request without one is rejected", () => {
  process.env.AGENT_RUNTIME_SECRET = "correct-horse";
  assert.equal(isAuthorised(req()), false);
});

test("accepts the secret as a bearer token", () => {
  process.env.AGENT_RUNTIME_SECRET = "correct-horse";
  assert.equal(isAuthorised(req({ authorization: "Bearer correct-horse" })), true);
});

test("accepts the secret sent bare, without the bearer prefix", () => {
  process.env.AGENT_RUNTIME_SECRET = "correct-horse";
  assert.equal(isAuthorised(req({ authorization: "correct-horse" })), true);
});

test("rejects a wrong secret of the same length", () => {
  // Same length so the comparison cannot short-circuit on that alone.
  process.env.AGENT_RUNTIME_SECRET = "correct-horse";
  assert.equal(isAuthorised(req({ authorization: "Bearer incorrect-hors" })), false);
});

test("rejects a secret that is merely a prefix of the real one", () => {
  process.env.AGENT_RUNTIME_SECRET = "correct-horse";
  assert.equal(isAuthorised(req({ authorization: "Bearer correct" })), false);
});

test("rejects a secret with the real one as its prefix", () => {
  process.env.AGENT_RUNTIME_SECRET = "correct-horse";
  assert.equal(isAuthorised(req({ authorization: "Bearer correct-horse-battery" })), false);
});

test("an empty secret in the environment counts as no secret", () => {
  // Set-but-empty is what an unfilled .env line produces. Treating it as a
  // configured secret would reject every request; treating it as configured
  // authentication would be worse.
  process.env.AGENT_RUNTIME_SECRET = "";
  assert.equal(secret(), undefined);
  assert.equal(isAuthorised(req()), true);
});

test("binds to loopback unless told otherwise", () => {
  assert.equal(host(), "127.0.0.1");
  process.env.AGENT_RUNTIME_HOST = "0.0.0.0";
  assert.equal(host(), "0.0.0.0");
});

test("refuses to listen on a public host with no secret", () => {
  // The one genuinely dangerous combination: reachable from anywhere, with
  // nothing checking who is calling.
  process.env.AGENT_RUNTIME_HOST = "0.0.0.0";
  assert.throws(() => assertSafeToListen(), /refusing to listen/);
});

test("allows a public host once a secret is set", () => {
  process.env.AGENT_RUNTIME_HOST = "0.0.0.0";
  process.env.AGENT_RUNTIME_SECRET = "correct-horse";
  assert.doesNotThrow(() => assertSafeToListen());
});

test("allows loopback with no secret", () => {
  for (const h of ["127.0.0.1", "localhost", "::1"]) {
    process.env.AGENT_RUNTIME_HOST = h;
    assert.doesNotThrow(() => assertSafeToListen(), `${h} should be allowed`);
  }
});

test("treats a repeated authorization header as its first value", () => {
  // Node hands duplicated headers over as an array; indexing a string by [0]
  // would silently compare one character.
  process.env.AGENT_RUNTIME_SECRET = "correct-horse";
  assert.equal(isAuthorised(req({ authorization: ["correct-horse", "wrong"] })), true);
});

import test from "node:test";
import assert from "node:assert/strict";
import { describeError, errorMessage } from "./errors.js";

/// What a person is shown when something fails.
///
/// The rule under test is that a message is one sentence somebody can act on, or
/// the caller's fallback — never a library's diagnostics. The console keeps the
/// detail; the dialog does not.

// viem, verbatim, for a signature the person declined. This is what was being
// rendered into the dialog before there was anywhere to translate it.
const VIEM_REJECTION = `User rejected the request.
Request Arguments: from: 0xd18E28bF115Fe86Ebd265C917858acAEd6Ab1e21 to: 0xed0d926e3b804cf3cbbc497a04e2e7a0669c4da1 data: 0xa9059cbb0000000000000000000000dd9321fad8ec9835aec5c30
Contract Call: address: 0xed0d926e3b804cf3cbbc497a04e2e7a0669c4da1 function: transfer(address to, uint256 value) args: (0xDD9321FAd8Ec9835AEC5C302F29078554C85d0Aa, 5000000) sender: 0xd18E28bF115Fe86Ebd265C917858acAEd6Ab1e21
Docs: https://viem.sh/docs/contract/writeContract
Details: The user rejected the request
Version: viem@2.55.5`;

test("a declined signature is a cancellation, not a failure", () => {
  const described = describeError(new Error(VIEM_REJECTION), "could not create the agent");
  assert.equal(described.cancelled, true);
  assert.equal(described.message, "Cancelled. Nothing was charged.");
});

test("nothing of the library's diagnostics reaches the reader", () => {
  const { message } = describeError(new Error(VIEM_REJECTION), "could not create the agent");
  for (const leak of ["0xa9059cbb", "viem@", "Docs:", "sender:", "Request Arguments"]) {
    assert.ok(!message.includes(leak), `leaked ${leak}`);
  }
  assert.ok(message.length < 60, "a sentence, not a paragraph");
});

test("a rejection is recognised by its EIP-1193 code, whatever the wording", () => {
  // Wallets are consistent about 4001 and inventive about the message.
  const err = Object.assign(new Error("Пользователь отклонил запрос"), { code: 4001 });
  assert.equal(describeError(err, "fallback").cancelled, true);
});

test("a rejection nested in a cause is still a rejection", () => {
  const err = Object.assign(new Error("Transaction failed"), { cause: { code: 4001 } });
  assert.equal(describeError(err, "fallback").cancelled, true);
});

test("messages this application wrote pass through untouched", () => {
  // The point of the length limit is to catch stack traces, not to rewrite the
  // deliberate sentences the API routes already return.
  const mine = "that payment has already been used to create an agent";
  assert.equal(errorMessage(new Error(mine), "fallback"), mine);
  assert.equal(errorMessage({ error: mine }, "fallback"), mine, "an API body works too");
});

test("an unrecognised sprawl falls back rather than being truncated into nonsense", () => {
  const sprawl = "x".repeat(400);
  assert.equal(errorMessage(new Error(sprawl), "could not do the thing"), "could not do the thing");
});

test("common failures get an instruction, not a description", () => {
  const cases: [string, string][] = [
    ["insufficient funds for gas", "does not hold enough"],
    ["Failed to fetch", "Could not reach the server"],
    ["nonce too low", "already in flight"],
    ["429 Too Many Requests", "rate limiting"],
  ];
  for (const [raw, expected] of cases) {
    assert.match(errorMessage(new Error(raw), "fallback"), new RegExp(expected), raw);
  }
});

test("a thrown non-error does not become the word undefined", () => {
  assert.equal(errorMessage(undefined, "could not load"), "could not load");
  assert.equal(errorMessage(null, "could not load"), "could not load");
  assert.equal(errorMessage({}, "could not load"), "could not load");
  assert.equal(errorMessage("a plain string", "could not load"), "a plain string");
});

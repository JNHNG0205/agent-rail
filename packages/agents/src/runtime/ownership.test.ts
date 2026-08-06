import { test } from "node:test";
import assert from "node:assert/strict";
import { mayActAs, type AgentRecord } from "./store.js";

/// Who may act as an agent. This decides whether one person can spend another
/// person's agent's money, so it is worth stating every case rather than
/// trusting the shape of the expression.

const ALICE = "0xAAaaAAaaAAaaAAaaAAaaAAaaAAaaAAaaAAaaAAaa";
const BOB = "0xBBbbBBbbBBbbBBbbBBbbBBbbBBbbBBbbBBbbBBbb";

function agent(createdBy: string | null): AgentRecord {
  return {
    id: "assistant",
    name: "Your Assistant",
    role: "client",
    service: null,
    privateKey: "0x00",
    address: "0x1111111111111111111111111111111111111111",
    chainId: 84532,
    createdBy,
    createdAt: new Date().toISOString(),
    onboardedAt: new Date().toISOString(),
  };
}

test("the owner may act as their own agent", () => {
  assert.equal(mayActAs(agent(ALICE), ALICE), true);
});

test("someone else may not", () => {
  // The property that matters: an agent holds USDC and signs its own
  // transactions, so acting as it is spending its money.
  assert.equal(mayActAs(agent(ALICE), BOB), false);
});

test("an anonymous caller may not act as an owned agent", () => {
  assert.equal(mayActAs(agent(ALICE), null), false);
});

test("ownership comparison ignores address casing", () => {
  // A checksummed address and a lowercase one are the same account, and which
  // form arrives depends on where it came from.
  assert.equal(mayActAs(agent(ALICE.toLowerCase()), ALICE), true);
  assert.equal(mayActAs(agent(ALICE), ALICE.toLowerCase()), true);
});

test("an unowned agent stays open to anyone", () => {
  // Agents created before ownership existed have no owner. They remain usable
  // rather than becoming unreachable, which is what lets this be added to a
  // running system instead of requiring a reset.
  assert.equal(mayActAs(agent(null), ALICE), true);
  assert.equal(mayActAs(agent(null), BOB), true);
  assert.equal(mayActAs(agent(null), null), true);
});

test("a near-miss owner is rejected", () => {
  // Guards against a comparison loosened to a prefix or a length.
  assert.equal(mayActAs(agent(ALICE), ALICE.slice(0, -1)), false);
  assert.equal(mayActAs(agent(ALICE), `${ALICE}0`), false);
  assert.equal(mayActAs(agent(ALICE), ""), false);
});

test("the identifier is opaque — any stable string works as an owner", () => {
  // Today an address, tomorrow a verified identity. Nothing here interprets it,
  // so the identity source can change without touching this rule.
  const did = "did:privy:clw3xyz123";
  assert.equal(mayActAs(agent(did), did), true);
  assert.equal(mayActAs(agent(did), "did:privy:someoneelse"), false);
});

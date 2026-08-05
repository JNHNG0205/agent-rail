import { test } from "node:test";
import assert from "node:assert/strict";
import { linkedWallets } from "./privy.js";

/// Which addresses a withdrawal may be sent to.
///
/// This decides where money goes, and a transfer cannot be undone. The rule is
/// that only a wallet Privy signed for is a destination — so these are written
/// as attempts to smuggle an address past it, not as a happy path with
/// variations. The signature is checked before any of this runs; what is tested
/// here is that a validly-signed token still cannot introduce an address its
/// user never linked.

const ALICE = "0xAAaaAAaaAAaaAAaaAAaaAAaaAAaaAAaaAAaaAAaa";
const BOB = "0xBBbbBBbbBBbbBBbbBBbbBBbbBBbbBBbbBBbbBBbb";

function claims(accounts: unknown) {
  // Privy stringifies this claim rather than nesting an array.
  return { linked_accounts: typeof accounts === "string" ? accounts : JSON.stringify(accounts) };
}

test("a linked ethereum wallet is a destination", () => {
  const wallets = linkedWallets(claims([{ type: "wallet", address: ALICE, chain_type: "ethereum" }]));
  assert.deepEqual(wallets, [{ address: ALICE.toLowerCase() }]);
});

test("every linked wallet is returned, not just the first", () => {
  // Someone may link a second wallet and withdraw to either.
  const wallets = linkedWallets(
    claims([
      { type: "wallet", address: ALICE, chain_type: "ethereum" },
      { type: "wallet", address: BOB, chain_type: "ethereum" },
    ]),
  );
  assert.deepEqual(wallets.map((w) => w.address), [ALICE.toLowerCase(), BOB.toLowerCase()]);
});

test("addresses are lowercased so comparison cannot fail on case", () => {
  // A checksummed address and a lowercase one are the same account. Comparing
  // them raw would reject a legitimate destination.
  const [wallet] = linkedWallets(claims([{ type: "wallet", address: ALICE }]));
  assert.equal(wallet!.address, ALICE.toLowerCase());
});

test("an email or social account is not a wallet", () => {
  // These sit in the same array. Anything not filtered by type would be read as
  // an address and sent money.
  const wallets = linkedWallets(
    claims([
      { type: "email", address: "someone@example.com" },
      { type: "google_oauth", email: "someone@example.com" },
      { type: "wallet", address: ALICE },
    ]),
  );
  assert.deepEqual(wallets, [{ address: ALICE.toLowerCase() }]);
});

test("a non-ethereum wallet is not a destination", () => {
  // A Solana address is a valid address, on a chain this USDC does not exist on.
  // Sending there is a permanent loss with no error to report it.
  const wallets = linkedWallets(
    claims([{ type: "wallet", address: ALICE, chain_type: "solana" }]),
  );
  assert.deepEqual(wallets, []);
});

test("anything that is not an address is refused", () => {
  // A valid signature says Privy issued the token; it does not promise every
  // field is the shape this code expects.
  for (const address of ["", "not-an-address", "0x123", `${ALICE}00`, null, 42, undefined]) {
    assert.deepEqual(linkedWallets(claims([{ type: "wallet", address }])), [], String(address));
  }
});

test("a malformed claim yields no destination, rather than throwing", () => {
  // The caller refuses a withdrawal with no verified wallet, which is the safe
  // outcome. Throwing here would turn a missing claim into a 500.
  assert.deepEqual(linkedWallets({ linked_accounts: "not json" }), []);
  assert.deepEqual(linkedWallets({ linked_accounts: "{}" }), []);
  assert.deepEqual(linkedWallets({}), []);
  assert.deepEqual(linkedWallets({ linked_accounts: 7 }), []);
});

test("an array is accepted as well as a stringified one", () => {
  // Documented as a string, but a shape change that broke this silently would
  // leave every user unable to withdraw.
  assert.deepEqual(linkedWallets({ linked_accounts: [{ type: "wallet", address: ALICE }] }), [
    { address: ALICE.toLowerCase() },
  ]);
});

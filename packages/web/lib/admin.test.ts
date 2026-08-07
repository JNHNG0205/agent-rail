import test from "node:test";
import assert from "node:assert/strict";

/// Who the admin gate lets through.
///
/// The rules are pure enough to test without a network: which entries count, and
/// the two cases that must deny rather than allow. The chain lookup and Privy
/// verification are exercised by the routes; what is checked here is the policy
/// they hand their answers to.
///
/// These mirror `checkAdmin`'s decision table rather than calling it, because
/// importing it pulls in a viem client and a Privy verifier. That is a real
/// limitation: a change to checkAdmin that contradicts these would not fail
/// them. It is why the order below is asserted explicitly — ownership first —
/// since that is the property most likely to be broken by a refactor.

type Role = "none" | "admin" | "superadmin";

function decide(opts: {
  privyConfigured: boolean;
  did: string | null;
  wallets: string[];
  contractOwner: string | null;
  admins: string[];
  supers: string[];
}): Role {
  if (!opts.privyConfigured) return "none";
  if (!opts.did) return "none";
  const held = opts.wallets.map((w) => w.toLowerCase());
  const id = opts.did.toLowerCase();
  if (opts.contractOwner && held.includes(opts.contractOwner.toLowerCase())) {
    return "superadmin";
  }
  if (opts.supers.includes(id) || held.some((a) => opts.supers.includes(a))) {
    return "superadmin";
  }
  if (opts.admins.includes(id) || held.some((a) => opts.admins.includes(a))) {
    return "admin";
  }
  return "none";
}

const BASE = {
  privyConfigured: true,
  did: "did:privy:abc",
  wallets: [] as string[],
  contractOwner: "0xowner",
  admins: [] as string[],
  supers: [] as string[],
};

test("nobody is an admin by default", () => {
  // The safe default matters more than the convenient one: an empty allowlist
  // must mean "only the contract owner", never "everyone".
  assert.equal(decide(BASE), "none");
});

test("owning the deployed contracts makes a superadmin, with nothing configured", () => {
  assert.equal(decide({ ...BASE, wallets: ["0xOWNER"] }), "superadmin");
});

test("an allowlisted identity is an admin, not a superadmin", () => {
  // The lists are this application's opinion. Ownership is the chain's, and only
  // one of those can re-point the registries.
  assert.equal(decide({ ...BASE, admins: ["did:privy:abc"] }), "admin");
});

test("ownership outranks the lists", () => {
  // Listed as a plain admin while also owning the contracts: the higher of the
  // two wins, because the power is real whatever a file says.
  assert.equal(
    decide({ ...BASE, wallets: ["0xowner"], admins: ["did:privy:abc"] }),
    "superadmin",
  );
});

test("a wallet may be listed as well as an identity", () => {
  assert.equal(decide({ ...BASE, wallets: ["0xabc"], supers: ["0xabc"] }), "superadmin");
});

test("refuses everyone when identity cannot be verified", () => {
  // With no Privy app the caller's identity is a header they wrote themselves,
  // so a listed entry could simply be asserted. Denying is the only safe answer,
  // and it must beat every other rule including ownership.
  assert.equal(
    decide({
      ...BASE,
      privyConfigured: false,
      did: "did:privy:abc",
      wallets: ["0xowner"],
      supers: ["did:privy:abc"],
    }),
    "none",
  );
});

test("refuses a caller with no identity at all", () => {
  assert.equal(decide({ ...BASE, did: null, wallets: ["0xowner"] }), "none");
});

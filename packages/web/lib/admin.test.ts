import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, passwordMatches, normaliseEmail } from "./admin";

/// How an administrator's password is stored and checked.
///
/// These are the parts that hold no database: the hash format, the comparison,
/// and the address normalisation that decides whether two sign-ins are the same
/// account. Session signing and the lookups around it need Postgres, and are
/// exercised through the routes instead.

test("a stored password is not the password", () => {
  const stored = hashPassword("correct horse");
  assert.ok(!stored.includes("correct horse"), "the plaintext must not survive");
  assert.match(stored, /^[0-9a-f]{32}:[0-9a-f]{128}$/, "salt and derived key, both hex");
});

test("the same password hashes differently every time", () => {
  // A per-row salt, so two administrators choosing the same password do not
  // share a hash and the table cannot be scanned for repeats.
  assert.notEqual(hashPassword("correct horse"), hashPassword("correct horse"));
});

test("accepts the password it was given, and nothing near it", () => {
  const stored = hashPassword("correct horse");
  assert.equal(passwordMatches("correct horse", stored), true);
  assert.equal(passwordMatches("correct hors", stored), false);
  assert.equal(passwordMatches("Correct Horse", stored), false, "case matters");
  assert.equal(passwordMatches("", stored), false);
});

test("refuses a malformed stored value instead of throwing", () => {
  // These would mean a corrupted or hand-edited row. Every one of them must deny
  // rather than crash the sign-in route, and none may accidentally pass.
  for (const stored of ["", ":", "nosalt", "abc:", ":abc", "zz:zz", "abc:def"]) {
    assert.equal(passwordMatches("anything", stored), false, JSON.stringify(stored));
  }
});

test("a derived key of the wrong length never matches", () => {
  // timingSafeEqual throws on a length mismatch, so this has to be checked
  // before comparing rather than caught afterwards.
  const [salt] = hashPassword("correct horse").split(":");
  assert.equal(passwordMatches("correct horse", `${salt}:${"ab".repeat(8)}`), false);
});

test("an email is one account however it is typed", () => {
  assert.equal(normaliseEmail("  Admin@Example.COM "), "admin@example.com");
});

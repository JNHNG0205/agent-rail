import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUsdc, formatUsdc } from "./constants.js";

/// Turning a written amount into money.
///
/// This decides how much is escrowed and how much is withdrawn, so an error
/// here is an error in someone's balance. The previous code did
/// `Number(price) * 1e6`, which happens to be right for the small whole numbers
/// used so far — these tests exist so that stays a property rather than luck.

test("whole amounts", () => {
  assert.equal(parseUsdc("0"), 0n);
  assert.equal(parseUsdc("1"), 1_000_000n);
  assert.equal(parseUsdc("10"), 10_000_000n);
  assert.equal(parseUsdc("1000"), 1_000_000_000n);
});

test("decimal amounts, to the full six places", () => {
  assert.equal(parseUsdc("2.5"), 2_500_000n);
  assert.equal(parseUsdc("0.1"), 100_000n);
  assert.equal(parseUsdc("0.000001"), 1n);
  assert.equal(parseUsdc("12.345678"), 12_345_678n);
});

test("trailing places are padded, not truncated", () => {
  // "0.1" is a tenth, not one millionth. Reading the fraction as written would
  // be off by a factor of 100000.
  assert.equal(parseUsdc("0.1"), 100_000n);
  assert.equal(parseUsdc("0.10"), 100_000n);
  assert.equal(parseUsdc("0.100000"), 100_000n);
});

test("the values a float gets wrong", () => {
  // Number("0.07") * 1e6 is 70000.00000000001, and Number("4.35") * 1e6 is
  // 4349999.999999999 — which floors to 4349999, a cent short. Integer
  // arithmetic has no such case.
  assert.equal(parseUsdc("0.07"), 70_000n);
  assert.equal(parseUsdc("4.35"), 4_350_000n);
  assert.equal(parseUsdc("8.16"), 8_160_000n);
});

test("an amount too large for a float is still exact", () => {
  // Beyond 2^53 a float cannot represent consecutive integers. bigint can.
  assert.equal(parseUsdc("90071992547.409911"), 90_071_992_547_409_911n);
});

test("more than six decimal places is refused, not rounded", () => {
  // USDC cannot represent it. Silently dropping the remainder would take a
  // different amount than the one someone wrote.
  assert.throws(() => parseUsdc("1.0000001"), /USDC amount/);
});

test("anything that is not a positive decimal is refused", () => {
  for (const value of ["", " ", "1e6", "-5", "0x10", "1,000", " 10", "10 ", "abc", ".5", "1."]) {
    assert.throws(() => parseUsdc(value), /USDC amount/, JSON.stringify(value));
  }
});

test("parse and format are inverses", () => {
  // formatUsdc is what the UI shows; parseUsdc is what the chain receives. If
  // they disagree, a person is quoted one number and charged another.
  for (const value of ["0.000000", "1.000000", "2.500000", "12.345678", "1000.000001"]) {
    assert.equal(formatUsdc(parseUsdc(value)), value);
  }
});

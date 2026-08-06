import { test } from "node:test";
import assert from "node:assert/strict";
import { formatUsdc } from "./agentrail-data.js";
import { formatUsdc as exactUsdc, parseUsdc } from "@agentrail/shared";

/// How an amount is shown, as distinct from how it is moved.
///
/// Two formatters exist and confusing them costs money. This one rounds to two
/// places for a person reading a balance. The one in shared keeps all six,
/// because that is what USDC stores and what a transaction carries.
///
/// The distinction is not theoretical: two places passed the display string
/// back as a transaction amount. It rounded, so a withdrawal would have left
/// fractions behind, and it carried a " USDC" suffix that parseUsdc rejects —
/// so the request would have failed outright.

test("two decimal places, for reading", () => {
  assert.equal(formatUsdc(0n), "0.00");
  assert.equal(formatUsdc(2_500_000n), "2.50");
  assert.equal(formatUsdc(10_000_000n), "10.00");
  assert.equal(formatUsdc(15_000_000n), "15.00");
});

test("truncates, and never rounds up", () => {
  // Showing fewer places is fine; showing more money than exists is not.
  // 0.999999 displayed as "1.00" is a balance that cannot be withdrawn, and a
  // person who tries gets an error the screen just told them was impossible.
  assert.equal(formatUsdc(999_999n), "0.99");
  assert.equal(formatUsdc(7_529_999n), "7.52");
  assert.equal(formatUsdc(7_523_456n), "7.52");
  assert.equal(formatUsdc(5_000n), "0.00");
});

test("the displayed figure is never larger than the real one", () => {
  // The property, stated directly rather than by example.
  for (const minorUnits of [0n, 1n, 4_999n, 999_999n, 1_000_001n, 7_529_999n, 123_456_789n]) {
    const shown = parseUsdc(formatUsdc(minorUnits));
    assert.ok(shown <= minorUnits, `${formatUsdc(minorUnits)} overstates ${minorUnits}`);
  }
});

test("carries no unit", () => {
  // It used to append " USDC", and every caller that added its own then showed
  // it twice — "5.000000 USDC USDC" reached a screenshot.
  for (const value of [0n, 1n, 2_500_000n, 10_000_000n]) {
    assert.ok(!formatUsdc(value).includes("USDC"), `${value} should carry no unit`);
  }
});

test("a large balance stays exact, not floated", () => {
  // Above 2^53 a float cannot hold consecutive integers, so a big balance would
  // display a number the chain never held.
  assert.equal(formatUsdc(9_007_199_254_740_993n), "9007199254.74");
});

test("the display format is NOT accepted as a transaction amount", () => {
  // The property that matters. If this ever parses, the two formatters have
  // been confused again and a withdrawal will move a rounded amount.
  const balance = 7_523_456n;
  assert.equal(formatUsdc(balance), "7.52");
  assert.notEqual(parseUsdc(formatUsdc(balance)), balance);
});

test("the exact format round-trips, and is what money paths must use", () => {
  for (const balance of [0n, 1n, 999_999n, 7_523_456n, 10_000_000n]) {
    assert.equal(parseUsdc(exactUsdc(balance)), balance);
  }
});

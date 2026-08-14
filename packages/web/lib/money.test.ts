import test from "node:test";
import assert from "node:assert/strict";
import { exactUsdcAmount, formatUsdc } from "./agentrail-data";
import { parseUsdc } from "@agentrail/shared";

/// The two ways a USDC amount is written, and why there are two.
///
/// One is read, the other is spent. Reading wants two places, because six is
/// noise on a screen; spending wants every place, because a truncated balance
/// leaves fractions behind that somebody asked to move.

test("what is read shows two places and never overstates", () => {
  // Truncated, never rounded: showing more money than exists is the one
  // direction this must not move.
  assert.equal(formatUsdc(50_000_000n), "50.00");
  assert.equal(formatUsdc(21_500_000n), "21.50");
  assert.equal(formatUsdc(999_999n), "0.99", "0.999999 must not become 1.00");
  assert.equal(formatUsdc(1n), "0.00");
});

test("what is spent keeps every place, and drops only trailing zeros", () => {
  assert.equal(exactUsdcAmount(50_000_000n), "50");
  assert.equal(exactUsdcAmount(21_500_000n), "21.5");
  assert.equal(exactUsdcAmount(999_999n), "0.999999");
  assert.equal(exactUsdcAmount(1n), "0.000001");
  assert.equal(exactUsdcAmount(0n), "0");
});

test("a spend amount round-trips back to the same minor units", () => {
  // The whole point: prefilling a field with this and parsing it again must
  // move exactly what the account holds, to the last unit.
  for (const minor of [0n, 1n, 999_999n, 1_000_000n, 21_500_000n, 50_000_000n, 1_000_000_007n]) {
    assert.equal(parseUsdc(exactUsdcAmount(minor)), minor, String(minor));
  }
});

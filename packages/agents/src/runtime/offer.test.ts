import test from "node:test";
import assert from "node:assert/strict";
import { normaliseOffer, type RawOffer } from "./offer.js";

/// What a proposal is forced into before it can become permanent terms.
///
/// The model's own output is not trusted here. A provider registration is
/// soulbound, and its requirements are then applied unchanged to every job the
/// agent ever takes, so anything unsatisfiable that gets through is unsatisfiable
/// for ever — there is no second pass to fix it.

function raw(over: Partial<RawOffer> = {}): RawOffer {
  return {
    summary: "A custom HTML page",
    priceUsdc: "25",
    deliverable: "text",
    category: "code",
    requirements: ["includes a title", "includes a heading"],
    ...over,
  };
}

test("drops blank requirements before the cap, not after", () => {
  // A blank term can never be satisfied, so it refunds every job. Filtering
  // after slice(0, 4) would let one consume a slot and leave three real terms.
  const offer = normaliseOffer(
    raw({ requirements: ["a", "   ", "b", "", "c", "d"] }),
  );

  assert.deepEqual(offer.requirements, ["a", "b", "c", "d"]);
});

test("keeps at most four requirements", () => {
  const offer = normaliseOffer(
    raw({ requirements: ["a", "b", "c", "d", "e", "f"] }),
  );

  assert.equal(offer.requirements.length, 4);
});

test("trims surrounding whitespace from each requirement", () => {
  const offer = normaliseOffer(raw({ requirements: ["  includes a title  ", "b"] }));

  assert.equal(offer.requirements[0], "includes a title");
});

test("clamps the price into the range the directory assumes", () => {
  assert.equal(normaliseOffer(raw({ priceUsdc: "0" })).priceUsdc, "1");
  assert.equal(normaliseOffer(raw({ priceUsdc: "5000" })).priceUsdc, "100");
  assert.equal(normaliseOffer(raw({ priceUsdc: "25" })).priceUsdc, "25");
});

test("rounds a fractional price to whole USDC", () => {
  assert.equal(normaliseOffer(raw({ priceUsdc: "12.6" })).priceUsdc, "13");
});

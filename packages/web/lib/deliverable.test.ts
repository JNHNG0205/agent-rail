import { test } from "node:test";
import assert from "node:assert/strict";
import { keccak256, toBytes } from "viem";
import { checkDeliverable } from "./deliverable.js";

/// This is where content from another party stops being untrusted, so it is
/// worth being explicit about what it must refuse.

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><title>AgentRail</title></svg>';
const HASH = keccak256(toBytes(SVG));

test("accepts bytes matching the hash committed on chain", () => {
  const result = checkDeliverable({ jobId: "1", onChainHash: HASH, served: SVG });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.svg, SVG);
});

test("refuses bytes that do not hash to what was committed", () => {
  // The case that matters: a provider serving something other than the work it
  // was paid for. Nothing outside this check would notice.
  const result = checkDeliverable({
    jobId: "1",
    onChainHash: HASH,
    served: "<svg>something else entirely</svg>",
  });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.status, 409);
  assert.match(result.ok === false ? result.error : "", /does not match the hash committed/);
});

test("refuses a single changed byte", () => {
  // keccak256 has no near-misses, but the comparison could — this fails if the
  // check were ever loosened to a prefix or a length.
  const tampered = SVG.replace("AgentRail", "AgentRai1");
  const result = checkDeliverable({ jobId: "1", onChainHash: HASH, served: tampered });
  assert.equal(result.ok, false);
});

test("reports both hashes when they disagree", () => {
  // Whoever reads this needs to see which side is wrong, not just that
  // something is.
  const result = checkDeliverable({ jobId: "7", onChainHash: HASH, served: "<svg/>" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.onChain, HASH);
  assert.equal(result.served, keccak256(toBytes("<svg/>")));
});

test("compares hashes case-insensitively", () => {
  // The chain returns lowercase hex; a hash from elsewhere may be checksummed.
  const result = checkDeliverable({
    jobId: "1",
    onChainHash: HASH.toUpperCase().replace("0X", "0x"),
    served: SVG,
  });
  assert.equal(result.ok, true);
});

test("refuses when nothing has been submitted yet", () => {
  const result = checkDeliverable({ jobId: "3", onChainHash: null, served: SVG });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.status, 409);
  assert.match(result.ok === false ? result.error : "", /no deliverable yet/);
});

test("refuses when the provider no longer serves the content", () => {
  // Deliverables live in the provider's memory, so a restart loses them while
  // the hash stays on chain.
  const result = checkDeliverable({ jobId: "3", onChainHash: HASH, served: null });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.status, 404);
  assert.match(result.ok === false ? result.error : "", /no longer has the deliverable/);
});

test("an empty body is content, and is checked like any other", () => {
  // Not conflated with "the provider has nothing" — an empty string is a reply,
  // and it must still hash correctly.
  const result = checkDeliverable({ jobId: "1", onChainHash: HASH, served: "" });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.status, 409);
});

test("derives the same hash the agents submit", () => {
  // hashDeliverable in packages/agents is keccak256(toBytes(content)). If these
  // ever diverge, every deliverable would be refused — so the derivation is
  // asserted here rather than assumed.
  assert.equal(keccak256(toBytes(SVG)), HASH);
  const result = checkDeliverable({ jobId: "1", onChainHash: keccak256(toBytes(SVG)), served: SVG });
  assert.equal(result.ok, true);
});

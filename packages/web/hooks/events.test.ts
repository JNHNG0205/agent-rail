import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChainEvent } from "@agentrail/shared";
import { usdcFrom, describeEvent, toFormatted } from "./useLiveEvents.js";

/// Turning an indexed chain event into a line someone reads.
///
/// Two things here can be wrong in ways nobody notices. An amount arrives from
/// JSON as a string and is money, so it must not go near a float. And a
/// timestamp decides the order of the feed, so stamping an event with the time
/// it was fetched puts a week-old backfilled event at the top as though it had
/// just happened — which is what this did until recently.

function event(over: Partial<ChainEvent> = {}): ChainEvent {
  return {
    id: "0xabc-1",
    chainId: 84532,
    contract: "JobContract",
    eventName: "JobCompleted",
    jobId: "42",
    txHash: "0xabc",
    logIndex: 1,
    blockNumber: "100",
    blockTimestamp: "1800000000",
    args: {},
    ...over,
  } as ChainEvent;
}

test("an amount is read as minor units through BigInt", () => {
  // 10 USDC is 10000000 minor units. Reading it as whole USDC would report a
  // ten-million-dollar job.
  assert.equal(usdcFrom({ amount: "10000000" }), "10.00 USDC");
  assert.equal(usdcFrom({ amount: "2500000" }), "2.50 USDC");
  // Truncated for reading, and truncation can only understate: a dust amount
  // shows as nothing rather than as a whole cent that is not there.
  assert.equal(usdcFrom({ amount: "1" }), "0.00 USDC");
});

test("a refund is an amount too", () => {
  // JobCancelled carries `refund`, not `amount`. Missing it would show every
  // refund as zero.
  assert.equal(usdcFrom({ refund: "5000000" }), "5.00 USDC");
});

test("an amount beyond a float's range is still exact", () => {
  // Above 2^53 a float cannot represent consecutive integers, so a large
  // settlement would display a different number than the chain recorded.
  //
  // The amount is chosen so the loss lands in the digits that survive
  // truncation. Now that this reads to two places, a value like 9007199254740993
  // minor units would round to the same string either way and prove nothing —
  // the float path has to break the whole-number part for the test to see it.
  assert.equal(
    usdcFrom({ amount: "9007199254740993000000" }),
    "9007199254740993.00 USDC",
    "a float would report ...992 here",
  );
});

test("an event with no amount says so by omission, not by zero", () => {
  // "0 USDC" for an event that never carried one is a claim; undefined is not.
  assert.equal(usdcFrom({}), undefined);
  assert.equal(usdcFrom({ amount: null }), undefined);
  assert.equal(usdcFrom({ amount: "not a number" }), undefined);
  assert.equal(usdcFrom({ amount: {} }), undefined);
});

test("each event a person cares about reads as a sentence", () => {
  assert.match(describeEvent("JobCreated", "7", "10.000000 USDC"), /Job #7 created with 10/);
  assert.match(describeEvent("JobFunded", "7", "10.000000 USDC"), /Job #7 funded/);
  assert.match(describeEvent("DeliverableSubmitted", "7"), /Deliverable submitted for Job #7/);
  assert.match(describeEvent("JobCompleted", "7", "10.000000 USDC"), /settled and completed/);
  assert.match(describeEvent("JobCancelled", "7", "10.000000 USDC"), /cancelled.*Refunded/);
});

test("an unrecognised event still says something true", () => {
  // New contracts emit events this list has never seen. Falling through to the
  // raw name is honest; showing nothing loses the event entirely.
  assert.equal(describeEvent("SomethingNew", undefined), "Event: SomethingNew");
});

test("an event carries the block's time, not the moment it was fetched", () => {
  // The feed is ordered by this. Using now() puts a backfilled event from last
  // week at the top, above something that genuinely just happened.
  // A block from 2020. If this ever reports "moments ago", the block timestamp
  // is being ignored in favour of the clock.
  const formatted = toFormatted(event({ blockTimestamp: "1600000000" }));
  assert.equal(formatted.timestamp.getTime(), 1_600_000_000_000);
  const secondsSince = (Date.now() - formatted.timestamp.getTime()) / 1000;
  assert.ok(secondsSince > 60, `expected an old event, got one ${secondsSince}s old`);
});

test("a settlement shows its amount", () => {
  const formatted = toFormatted(event({ eventName: "JobCompleted", args: { amount: "10000000" } }));
  assert.equal(formatted.formattedAmount, "10.00 USDC");
  assert.match(formatted.details, /Job #42 settled and completed \(10\.00 USDC\)/);
});

test("the id is the chain's, so the same event cannot appear twice", () => {
  // txHash-logIndex, assigned by the indexer. A generated id would let one
  // event show up again on every poll.
  assert.equal(toFormatted(event({ id: "0xdeadbeef-3" })).id, "0xdeadbeef-3");
});

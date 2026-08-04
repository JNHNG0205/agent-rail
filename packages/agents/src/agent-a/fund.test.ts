import { test } from "node:test";
import assert from "node:assert/strict";
import { JobState } from "@agentrail/shared";
import { waitForAllowance, fundWithRetry } from "./fund.js";

const TEN_USDC = 10_000_000n;

test("waitForAllowance returns as soon as the approval is visible", async () => {
  let reads = 0;
  await waitForAllowance({
    amount: TEN_USDC,
    readAllowance: async () => {
      reads += 1;
      return TEN_USDC;
    },
    delayMs: 1,
  });

  assert.equal(reads, 1, "expected no polling once the allowance is already there");
});

test("waitForAllowance polls while the endpoint still reports zero", async () => {
  // The lag this exists for: the approve is mined, but the node answering this
  // read has not applied that block yet.
  let reads = 0;
  await waitForAllowance({
    amount: TEN_USDC,
    readAllowance: async () => {
      reads += 1;
      return reads < 3 ? 0n : TEN_USDC;
    },
    delayMs: 1,
  });

  assert.equal(reads, 3);
});

test("waitForAllowance gives up rather than hanging forever", async () => {
  await assert.rejects(
    () =>
      waitForAllowance({
        amount: TEN_USDC,
        readAllowance: async () => 0n,
        attempts: 3,
        delayMs: 1,
      }),
    /did not become visible/,
  );
});

test("fundWithRetry succeeds on the first attempt", async () => {
  let sends = 0;
  await fundWithRetry({
    readState: async () => JobState.Open,
    send: async () => {
      sends += 1;
      return { status: "success", hash: "0xabc" };
    },
    delayMs: 1,
  });

  assert.equal(sends, 1);
});

test("fundWithRetry retries a transient revert and then succeeds", async () => {
  // This is the observed failure: gas estimation runs against a node that has
  // not applied the approve, transferFrom would fail, and the send throws
  // "execution reverted" before anything reaches the chain.
  let sends = 0;
  await fundWithRetry({
    readState: async () => JobState.Open,
    send: async () => {
      sends += 1;
      if (sends === 1) throw new Error("execution reverted");
      return { status: "success", hash: "0xabc" };
    },
    delayMs: 1,
  });

  assert.equal(sends, 2, "expected the transient revert to be retried");
});

test("fundWithRetry retries a receipt that reverted on chain", async () => {
  let sends = 0;
  await fundWithRetry({
    readState: async () => JobState.Open,
    send: async () => {
      sends += 1;
      return sends === 1
        ? { status: "reverted", hash: "0xbad" }
        : { status: "success", hash: "0xgood" };
    },
    delayMs: 1,
  });

  assert.equal(sends, 2);
});

test("fundWithRetry does not fund a job that is no longer Open", async () => {
  // The safety property that makes retrying acceptable at all: if an earlier
  // attempt actually landed, the retry must not pay a second time.
  let sends = 0;
  await fundWithRetry({
    readState: async () => JobState.Funded,
    send: async () => {
      sends += 1;
      return { status: "success", hash: "0xabc" };
    },
    delayMs: 1,
  });

  assert.equal(sends, 0, "expected no transaction for an already-funded job");
});

test("fundWithRetry stops as soon as the state moves on mid-retry", async () => {
  // A send that appears to fail but did land: the next state read shows Funded,
  // so the retry stops instead of double-funding.
  let sends = 0;
  let states = 0;
  await fundWithRetry({
    readState: async () => {
      states += 1;
      return states === 1 ? JobState.Open : JobState.Funded;
    },
    send: async () => {
      sends += 1;
      throw new Error("execution reverted");
    },
    delayMs: 1,
  });

  assert.equal(sends, 1, "expected exactly one send before the state moved on");
});

test("fundWithRetry reports the last error after exhausting its attempts", async () => {
  await assert.rejects(
    () =>
      fundWithRetry({
        readState: async () => JobState.Open,
        send: async () => {
          throw new Error("execution reverted");
        },
        attempts: 2,
        delayMs: 1,
      }),
    /failed after 2 attempts: execution reverted/,
  );
});

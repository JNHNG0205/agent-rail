import { test } from "node:test";
import assert from "node:assert/strict";
import { JobState } from "@agentrail/shared";
import { pendingJobIds, type JobSnapshot } from "./recover.js";

const ME = "0x9031059af8D2141a811f5DaBCF28CcCE89F34863";
const OTHER = "0xB53a6B981F553805d3744E230f6A5668DeA2B924";

/// Build a reader over a fixed job table, counting reads so a test can assert
/// the scan is bounded rather than walking every job ever created.
function reader(jobs: Record<string, JobSnapshot>) {
  const reads: bigint[] = [];
  const read = async (jobId: bigint): Promise<JobSnapshot> => {
    reads.push(jobId);
    return jobs[jobId.toString()] ?? { state: JobState.Terminal, evaluator: OTHER };
  };
  return { read, reads };
}

test("selects a submitted job assigned to this evaluator", async () => {
  const { read } = reader({
    "0": { state: JobState.Terminal, evaluator: ME },
    "1": { state: JobState.Submitted, evaluator: ME },
  });

  const pending = await pendingJobIds({ nextJobId: 2n, evaluator: ME, readJob: read });

  assert.deepEqual(pending, [1n]);
});

test("ignores jobs assigned to a different evaluator", async () => {
  // submitApproval would revert anyway, but evaluating costs a model call and
  // would report a verdict this agent has no authority to settle.
  const { read } = reader({
    "0": { state: JobState.Submitted, evaluator: OTHER },
  });

  const pending = await pendingJobIds({ nextJobId: 1n, evaluator: ME, readJob: read });

  assert.deepEqual(pending, []);
});

test("ignores every state except Submitted", async () => {
  // Open and Funded have no deliverable yet; Terminal is already decided.
  const { read } = reader({
    "0": { state: JobState.Open, evaluator: ME },
    "1": { state: JobState.Funded, evaluator: ME },
    "2": { state: JobState.Terminal, evaluator: ME },
    "3": { state: JobState.Submitted, evaluator: ME },
  });

  const pending = await pendingJobIds({ nextJobId: 4n, evaluator: ME, readJob: read });

  assert.deepEqual(pending, [3n]);
});

test("matches the evaluator address case-insensitively", async () => {
  // getJob returns lowercase; the account address is checksummed.
  const { read } = reader({
    "0": { state: JobState.Submitted, evaluator: ME.toLowerCase() },
  });

  const pending = await pendingJobIds({ nextJobId: 1n, evaluator: ME, readJob: read });

  assert.deepEqual(pending, [0n]);
});

test("scans no further back than the lookback window", async () => {
  const { read, reads } = reader({
    "0": { state: JobState.Submitted, evaluator: ME },
    "97": { state: JobState.Submitted, evaluator: ME },
  });

  const pending = await pendingJobIds({ nextJobId: 100n, evaluator: ME, readJob: read, lookback: 5n });

  // Job 0 is far past its timeout — the provider can already claim it, so the
  // evaluator's signature no longer decides the outcome.
  assert.deepEqual(pending, [97n]);
  assert.deepEqual(reads.sort((a, b) => Number(a - b)), [95n, 96n, 97n, 98n, 99n]);
});

test("returns nothing when no job has ever been created", async () => {
  const { read, reads } = reader({});

  const pending = await pendingJobIds({ nextJobId: 0n, evaluator: ME, readJob: read });

  assert.deepEqual(pending, []);
  assert.equal(reads.length, 0, "expected no chain reads on an empty contract");
});

test("returns pending ids in ascending order", async () => {
  // Oldest first: it is closest to its timeout, so it has the least slack.
  const { read } = reader({
    "1": { state: JobState.Submitted, evaluator: ME },
    "4": { state: JobState.Submitted, evaluator: ME },
    "7": { state: JobState.Submitted, evaluator: ME },
  });

  const pending = await pendingJobIds({
    nextJobId: 9n,
    evaluator: ME,
    readJob: read,
    batchSize: 2,
  });

  assert.deepEqual(pending, [1n, 4n, 7n]);
});

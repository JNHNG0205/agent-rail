import { JobState } from "@agentrail/shared";

/// The fields of a job this selection depends on. Narrower than the contract's
/// full struct so a test can construct one without inventing the rest.
export interface JobSnapshot {
  state: number;
  evaluator: string;
}

/// How many recent jobs to examine at startup. Anything older has passed its
/// timeout, so the provider can already claim it and the evaluator's signature
/// no longer decides the outcome.
export const RECOVERY_LOOKBACK = 100n;

/// Job ids still waiting on this evaluator's decision.
///
/// watchEvents starts from the current head, so a DeliverableSubmitted emitted
/// while the agent was down is never seen, and the escrow sits until the
/// provider claims a timeout with nothing anywhere saying why. Two jobs on Base
/// Sepolia are stranded in exactly that state, both from restarts during
/// development.
///
/// Reads state rather than replaying logs: `state` is the authoritative answer
/// to "does this still need me?", where replayed logs would also surface jobs
/// that have since settled and would have to be filtered by reading state anyway.
///
/// Jobs are read in batches — one round trip each is slow over a public
/// endpoint, and all at once trips its rate limit.
export async function pendingJobIds(opts: {
  nextJobId: bigint;
  evaluator: string;
  readJob: (jobId: bigint) => Promise<JobSnapshot>;
  lookback?: bigint;
  batchSize?: number;
}): Promise<bigint[]> {
  const lookback = opts.lookback ?? RECOVERY_LOOKBACK;
  const batchSize = opts.batchSize ?? 10;
  if (opts.nextJobId <= 0n) return [];

  const first = opts.nextJobId > lookback ? opts.nextJobId - lookback : 0n;
  const ids: bigint[] = [];
  for (let id = first; id < opts.nextJobId; id += 1n) ids.push(id);

  const mine = opts.evaluator.toLowerCase();
  const pending: bigint[] = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const jobs = await Promise.all(batch.map((id) => opts.readJob(id)));
    jobs.forEach((job, index) => {
      if (job.state !== JobState.Submitted) return;
      if (job.evaluator.toLowerCase() !== mine) return;
      pending.push(batch[index]!);
    });
  }

  return pending;
}

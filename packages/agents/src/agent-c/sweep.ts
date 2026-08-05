import "dotenv/config";
import type { Abi } from "viem";
import {
  addresses,
  JobContractAbi,
  JobState,
  JOB_STATE_LABELS,
  formatUsdc,
} from "@agentrail/shared";
import { publicClient, agentC } from "../lib/wallet.js";

/// Close out jobs that stalled before anything was delivered.
///
/// Development leaves these behind: a client that died between createJob and
/// fundJob leaves an Open job holding nothing, and one that died after funding
/// leaves escrow with no provider working. Neither resolves on its own — Open
/// and Funded have no timeout, only Submitted does — so they accumulate, and on
/// a chain that cannot be reset they stay in the job list forever.
///
/// JobContract lets the client or the evaluator cancel in exactly those two
/// states, which is what this uses. Cancelling a Funded job refunds the client;
/// cancelling an Open one moves nothing, because nothing was ever escrowed.
///
/// Submitted jobs are deliberately left alone. Work was delivered, so the
/// decision belongs to the evaluator's judgement or the provider's timeout
/// claim — not to a cleanup script, which cannot tell whether the deliverable
/// was any good.
///
///   npm run sweep:base-sepolia          list what would be cancelled
///   npm run sweep:base-sepolia -- --yes actually cancel

const CANCELLABLE = new Set<number>([JobState.Open, JobState.Funded]);

async function main() {
  const evaluator = await agentC();
  const apply = process.argv.includes("--yes");

  const nextJobId = (await publicClient.readContract({
    address: addresses.JobContract,
    abi: JobContractAbi,
    functionName: "nextJobId",
  })) as bigint;

  const stalled: { id: bigint; state: number; amount: bigint }[] = [];

  // Read in small batches; a public endpoint rate-limits a burst of reads.
  for (let start = 0n; start < nextJobId; start += 10n) {
    const ids: bigint[] = [];
    for (let id = start; id < start + 10n && id < nextJobId; id += 1n) ids.push(id);

    const jobs = await Promise.all(
      ids.map((id) =>
        publicClient.readContract({
          address: addresses.JobContract,
          abi: JobContractAbi,
          functionName: "getJob",
          args: [id],
        }),
      ),
    );

    jobs.forEach((job, i) => {
      if (!CANCELLABLE.has(job.state)) return;
      // Only jobs this agent is authorised to cancel.
      if (job.evaluator.toLowerCase() !== evaluator.address.toLowerCase()) return;
      stalled.push({ id: ids[i]!, state: job.state, amount: job.amount });
    });
  }

  if (stalled.length === 0) {
    console.log("[sweep] nothing stalled");
    return;
  }

  console.log(`[sweep] ${stalled.length} stalled job(s):`);
  for (const j of stalled) {
    const refund = j.state === JobState.Funded ? ` — refunds ${formatUsdc(j.amount)} USDC` : "";
    console.log(`  job ${j.id}: ${JOB_STATE_LABELS[j.state as 0]}${refund}`);
  }

  if (!apply) {
    console.log("[sweep] dry run — pass --yes to cancel these");
    return;
  }

  for (const j of stalled) {
    try {
      await evaluator.send([
        {
          to: addresses.JobContract,
          abi: JobContractAbi as Abi,
          functionName: "cancel",
          args: [j.id],
        },
      ]);
      console.log(`[sweep] job ${j.id} cancelled`);
    } catch (err) {
      // One job failing says nothing about the rest — a stalled job may have
      // moved on between the read and the write.
      const detail = err instanceof Error ? err.message.split("\n")[0] : String(err);
      console.error(`[sweep] job ${j.id} could not be cancelled: ${detail}`);
    }
  }
}

main().catch((err) => {
  console.error("[sweep]", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

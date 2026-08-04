import type { Abi } from "viem";
import { addresses, JobContractAbi, formatUsdc } from "@agentrail/shared";
import { publicClient, agentB } from "../lib/wallet.js";
import { watchEvents } from "../lib/watch.js";
import { hashDeliverable } from "../lib/hash.js";
import { runTask } from "./llm.js";
import { getCommission, rememberDeliverable } from "./server.js";

/// Listens for JobFunded, designs the poster it was commissioned to produce, and
/// submits the deliverable hash on-chain. The SVG itself stays off-chain and is
/// served over HTTP for the evaluator to fetch and re-hash.
export async function startWorker(): Promise<() => void> {
  const provider = await agentB();

  const unwatch = watchEvents({
    address: addresses.JobContract,
    abi: JobContractAbi,
    eventName: "JobFunded",
    onLogs: async (raw) => {
      for (const entry of raw) {
        const log = entry as { args: { jobId?: bigint } };
        const jobId = log.args.jobId;
        if (jobId === undefined) continue;

        try {
          // JobFunded carries only (jobId, amount) — read the job to find out
          // whether this provider is the one who was hired.
          const job = await publicClient.readContract({
            address: addresses.JobContract,
            abi: JobContractAbi,
            functionName: "getJob",
            args: [jobId],
          });

          if (job.provider.toLowerCase() !== provider.address.toLowerCase()) continue;

          const brief = getCommission(jobId);
          if (!brief) {
            console.error(
              `[agent-b] job ${jobId} funded but no commission received — nothing to produce`,
            );
            continue;
          }

          console.log(
            `[agent-b] job ${jobId} funded (${formatUsdc(job.amount)} USDC) — designing "${brief.title}"`,
          );

          const svg = await runTask(brief);
          const deliverableHash = hashDeliverable(svg);

          // Serve it before committing the hash, so the evaluator can never see
          // DeliverableSubmitted for content it cannot yet fetch.
          rememberDeliverable(jobId, svg);

          await provider.send([
            {
              to: addresses.JobContract,
              abi: JobContractAbi as Abi,
              functionName: "submitDeliverable",
              args: [jobId, deliverableHash],
            },
          ]);

          console.log(
            `[agent-b] job ${jobId} submitted, hash ${deliverableHash.slice(0, 18)}… (${svg.length} bytes)`,
          );
        } catch (err) {
          // A failure here leaves the job Funded; the client's timeout refund
          // path resolves it. Never crash the worker over a single job.
          const detail = err instanceof Error ? err.message : String(err);
          console.error(`[agent-b] job ${jobId} failed: ${detail}`);
        }
      }
    },
    onError: (err) =>
      console.error(
        "[agent-b] worker watch error:",
        err instanceof Error ? err.message : err,
      ),
  });

  return unwatch;
}

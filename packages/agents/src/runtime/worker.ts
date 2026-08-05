import type { Abi } from "viem";
import { addresses, JobContractAbi, formatUsdc } from "@agentrail/shared";
import { publicClient } from "../lib/wallet.js";
import { watchEvents } from "../lib/watch.js";
import { hashDeliverable } from "../lib/hash.js";
import { runTask } from "../provider/poster.js";
import { listAgents, accountOf, type AgentRecord } from "./store.js";
import { getCommission, rememberDeliverable } from "./server.js";

/// One watcher serving every provider the runtime hosts.
///
/// A watcher per agent would poll the same contract N times over, and on a
/// rate-limited endpoint that is what breaks first. Instead one subscription
/// reads JobFunded and dispatches on job.provider, so hosting ten agents costs
/// the same as hosting one.
export function startProviderWorker(): () => void {
  // Rebuilt per event rather than captured once, so an agent created after
  // startup is picked up without restarting the runtime.
  const providerFor = async (address: string): Promise<AgentRecord | undefined> =>
    (await listAgents()).find(
      (a) => a.role === "provider" && a.address.toLowerCase() === address.toLowerCase(),
    );

  return watchEvents({
    address: addresses.JobContract,
    abi: JobContractAbi as Abi,
    eventName: "JobFunded",
    onLogs: async (raw) => {
      for (const entry of raw) {
        const jobId = (entry as { args: { jobId?: bigint } }).args.jobId;
        if (jobId === undefined) continue;

        try {
          // JobFunded carries only (jobId, amount) — read the job to learn who
          // was hired.
          const job = await publicClient.readContract({
            address: addresses.JobContract,
            abi: JobContractAbi,
            functionName: "getJob",
            args: [jobId],
          });

          const agent = await providerFor(job.provider);
          if (!agent) continue;

          const brief = getCommission(agent.id, jobId);
          if (!brief) {
            console.error(
              `[runtime] ${agent.name}: job ${jobId} funded but no commission received`,
            );
            continue;
          }

          console.log(
            `[runtime] ${agent.name}: job ${jobId} funded (${formatUsdc(job.amount)} USDC) — designing "${brief.title}"`,
          );

          const svg = await runTask(brief);
          const deliverableHash = hashDeliverable(svg);

          // Serve it before committing the hash, so the evaluator can never see
          // DeliverableSubmitted for content it cannot yet fetch.
          rememberDeliverable(agent.id, jobId, svg);

          const account = await accountOf(agent);
          await account.send([
            {
              to: addresses.JobContract,
              abi: JobContractAbi as Abi,
              functionName: "submitDeliverable",
              args: [jobId, deliverableHash],
            },
          ]);

          console.log(
            `[runtime] ${agent.name}: job ${jobId} submitted, hash ${deliverableHash.slice(0, 18)}… (${svg.length} bytes)`,
          );
        } catch (err) {
          // A failure here leaves the job Funded, which the client's timeout
          // resolves. Never let one job stop the runtime.
          const detail = err instanceof Error ? err.message.split("\n")[0] : String(err);
          console.error(`[runtime] job ${jobId} failed: ${detail}`);
        }
      }
    },
    onError: (err) =>
      console.error("[runtime] watch error:", err instanceof Error ? err.message : err),
  });
}

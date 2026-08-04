import "dotenv/config";
import {
  addresses,
  JobContractAbi,
  agentLabel,
  type PosterBrief,
} from "@agentrail/shared";
import { publicClient, agentC } from "../lib/wallet.js";
import { watchEvents } from "../lib/watch.js";
import { review } from "./review.js";
import { approve } from "./approve.js";
import { pendingJobIds } from "./recover.js";

/// Agent C (evaluator) entry point: watch for submitted deliverables, fetch what
/// Agent B served, judge it against the commissioned brief, and sign the
/// decision that settles or refunds the job.
///
/// Independent of both counterparties — it neither commissions nor produces the
/// work. That separation is the point: a client that grades its own job has no
/// answer to "what stops it refusing to pay?".

function isPosterBrief(value: unknown): value is PosterBrief {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.title === "string" &&
    Array.isArray(v.requirements) &&
    v.requirements.every((r) => typeof r === "string")
  );
}

async function handleSubmission(jobId: bigint, providerUrl: string): Promise<void> {
  const job = await publicClient.readContract({
    address: addresses.JobContract,
    abi: JobContractAbi,
    functionName: "getJob",
    args: [jobId],
  });

  const evaluator = await agentC();
  // Only act on jobs where this agent is the assigned evaluator — submitApproval
  // would revert anyway, but there is no reason to spend a token evaluating.
  if (job.evaluator.toLowerCase() !== evaluator.address.toLowerCase()) return;

  console.log(
    `[agent-c] job ${jobId} submitted by ${agentLabel(job.provider)} — evaluating`,
  );

  const briefRes = await fetch(`${providerUrl}/commission/${jobId}`);
  if (!briefRes.ok) {
    console.error(`[agent-c] job ${jobId}: cannot fetch brief (HTTP ${briefRes.status})`);
    return;
  }
  const brief: unknown = await briefRes.json();
  if (!isPosterBrief(brief)) {
    console.error(`[agent-c] job ${jobId}: provider served a malformed brief`);
    return;
  }

  const svgRes = await fetch(`${providerUrl}/deliverable/${jobId}`);
  if (!svgRes.ok) {
    console.error(`[agent-c] job ${jobId}: cannot fetch deliverable (HTTP ${svgRes.status})`);
    return;
  }
  const svg = await svgRes.text();

  // review() re-derives the keccak256 and rejects a mismatch before spending a
  // token, so tampered or stale content never reaches the model.
  const verdict = await review(brief, svg, job.deliverableHash);

  console.log(
    `[agent-c] job ${jobId} verdict: ${verdict.approve ? "APPROVE" : "REJECT"} — ${verdict.reason}`,
  );
  if (verdict.missingElements.length > 0) {
    console.log(`[agent-c]   missing: ${verdict.missingElements.join(", ")}`);
  }

  const hash = await approve(jobId, job.deliverableHash, verdict.approve);
  console.log(
    `[agent-c] job ${jobId} ${verdict.approve ? "settled" : "refunded"} — tx ${hash.slice(0, 18)}…`,
  );
}

/// Evaluate jobs submitted while this agent was not running. Selection lives in
/// recover.ts; this supplies the chain reads and does the work.
async function recoverPending(providerUrl: string): Promise<void> {
  const evaluator = await agentC();

  const nextJobId = (await publicClient.readContract({
    address: addresses.JobContract,
    abi: JobContractAbi,
    functionName: "nextJobId",
  })) as bigint;

  const pending = await pendingJobIds({
    nextJobId,
    evaluator: evaluator.address,
    readJob: (jobId) =>
      publicClient.readContract({
        address: addresses.JobContract,
        abi: JobContractAbi,
        functionName: "getJob",
        args: [jobId],
      }),
  });

  if (pending.length === 0) return;
  console.log(
    `[agent-c] ${pending.length} job(s) awaiting evaluation from before startup: ${pending.join(", ")}`,
  );

  for (const jobId of pending) {
    try {
      await handleSubmission(jobId, providerUrl);
    } catch (err) {
      // Most likely the provider restarted too and no longer serves the
      // deliverable — it keeps them in memory. Nothing can be evaluated without
      // the content, so the job waits for the provider's timeout claim. Report
      // it and carry on; one unrecoverable job must not stop the others.
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[agent-c] job ${jobId} could not be recovered: ${detail}`);
    }
  }
}

async function main() {
  const evaluator = await agentC();
  const providerUrl = process.env.AGENT_B_URL ?? "http://127.0.0.1:4020";
  console.log(`[agent-c] evaluator ${evaluator.address}, provider at ${providerUrl}`);

  // Before watching, catch up on anything missed while down.
  try {
    await recoverPending(providerUrl);
  } catch (err) {
    // A failed scan must not stop the evaluator starting — new jobs still work.
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[agent-c] startup recovery scan failed: ${detail}`);
  }

  const unwatch = watchEvents({
    address: addresses.JobContract,
    abi: JobContractAbi,
    eventName: "DeliverableSubmitted",
    onLogs: async (raw) => {
      for (const entry of raw) {
        const log = entry as { args: { jobId?: bigint } };
        const jobId = log.args.jobId;
        if (jobId === undefined) continue;
        try {
          await handleSubmission(jobId, providerUrl);
        } catch (err) {
          // Leaving a job Submitted is recoverable: the provider can claim on
          // timeout. Never crash the evaluator over a single job.
          const detail = err instanceof Error ? err.message : String(err);
          console.error(`[agent-c] job ${jobId} failed: ${detail}`);
        }
      }
    },
    onError: (err) =>
      console.error("[agent-c] watch error:", err instanceof Error ? err.message : err),
  });

  const shutdown = () => {
    unwatch();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[agent-c] failed to start:", err instanceof Error ? err.message : err);
  process.exit(1);
});

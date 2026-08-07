import "dotenv/config";
import {
  addresses,
  JobContractAbi,
  agentLabel,
  type JobBrief,
} from "@agentrail/shared";
import { publicClient, agentC } from "../lib/wallet.js";
import { watchEvents } from "../lib/watch.js";
import { review } from "./review.js";
import { rememberReview } from "../runtime/reviews.js";
import { approve } from "./approve.js";
import { pendingJobIds } from "./recover.js";
import { locateProvider } from "./locate.js";

interface Endpoints {
  runtimeUrl: string;
}

/// Agent C (evaluator) entry point: watch for submitted deliverables, fetch what
/// Agent B served, judge it against the commissioned brief, and sign the
/// decision that settles or refunds the job.
///
/// Independent of both counterparties — it neither commissions nor produces the
/// work. That separation is the point: a client that grades its own job has no
/// answer to "what stops it refusing to pay?".

/// The brief arrives over HTTP from the provider being graded, so it is checked
/// rather than trusted. Requirements must be present and non-empty: an empty
/// list would be graded as "nothing was asked for", which every deliverable
/// satisfies — turning the evaluation into an automatic approval.
function isJobBrief(value: unknown): value is JobBrief {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.request === "string" &&
    v.request.length > 0 &&
    Array.isArray(v.requirements) &&
    v.requirements.length > 0 &&
    v.requirements.every((r) => typeof r === "string" && r.length > 0)
  );
}

async function handleSubmission(jobId: bigint, endpoints: Endpoints): Promise<void> {
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

  // Resolve where this provider serves. Which agent produced the work is only
  // known now, from job.provider — it cannot be configured ahead of time.
  const provider = await locateProvider(job.provider, endpoints);
  if (!provider) {
    // Says which of the two things went wrong. A job whose provider no hosted
    // agent serves is permanent and there is nothing to retry; a runtime that
    // is merely down will resolve on the next sweep.
    console.error(
      `[agent-c] job ${jobId}: no hosted agent serves ${job.provider} — is the runtime running?`,
    );
    return;
  }

  const briefRes = await fetch(`${provider.base}/commission/${jobId}`);
  if (!briefRes.ok) {
    console.error(`[agent-c] job ${jobId}: cannot fetch brief (HTTP ${briefRes.status})`);
    return;
  }
  const brief: unknown = await briefRes.json();
  if (!isJobBrief(brief)) {
    console.error(`[agent-c] job ${jobId}: provider served a malformed brief`);
    return;
  }

  const svgRes = await fetch(`${provider.base}/deliverable/${jobId}`);
  if (!svgRes.ok) {
    console.error(`[agent-c] job ${jobId}: cannot fetch deliverable (HTTP ${svgRes.status})`);
    return;
  }
  const svg = await svgRes.text();

  // review() re-derives the keccak256 and rejects a mismatch before spending a
  // token, so tampered or stale content never reaches the model.
  const verdict = await review(brief, svg, job.deliverableHash);

  // Recorded before it is submitted, so a crash between deciding and signing
  // leaves a note of what was about to happen rather than a settled job nobody
  // can account for. A storage failure must not stop the settlement: the verdict
  // is already made, and refusing to submit it would strand the escrow until the
  // timeout over a database that was merely unavailable.
  try {
    await rememberReview(jobId, verdict);
  } catch (err) {
    console.error(`[agent-c] job ${jobId}: could not record the reasoning —`, err);
  }

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
async function recoverPending(endpoints: Endpoints): Promise<void> {
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
      await handleSubmission(jobId, endpoints);
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
  const endpoints: Endpoints = {
    runtimeUrl: process.env.AGENT_RUNTIME_URL ?? "http://127.0.0.1:4030",
  };
  console.log(
    `[agent-c] evaluator ${evaluator.address}, runtime at ${endpoints.runtimeUrl}`,
  );

  // Before watching, catch up on anything missed while down.
  try {
    await recoverPending(endpoints);
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
          await handleSubmission(jobId, endpoints);
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

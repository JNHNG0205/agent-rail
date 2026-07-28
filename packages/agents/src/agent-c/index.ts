import "dotenv/config";
import { addresses, JobContractAbi } from "@agentrail/shared";
import { publicClient, agentC } from "../lib/wallet.js";
import { review } from "./review.js";
import { approve } from "./approve.js";

/// Agent C (evaluator) entry point: watch for submitted deliverables, fetch the content
/// Agent B served, judge it against the brief, and sign the approval that settles the job.
/// Independent of both counterparties — it neither commissions nor produces the work.
function main() {
  const { account } = agentC();
  console.log("[agent-c] evaluator", account.address);

  const unwatch = publicClient.watchContractEvent({
    address: addresses.JobContract,
    abi: JobContractAbi,
    eventName: "DeliverableSubmitted",
    onLogs: async (logs) => {
      for (const log of logs) {
        // TODO(M4): blocked on M1 — read the job to recover the brief and the provider URL,
        //           GET /deliverable/:jobId, then review() and approve(). JobContract
        //           reverts until M1 lands.
        void log;
        void review;
        void approve;
        console.log("[agent-c] DeliverableSubmitted seen — TODO(M4): fetch, review, sign.");
      }
    },
    onError: (err) => console.error("[agent-c] watch error:", err),
  });

  const shutdown = () => {
    unwatch();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();

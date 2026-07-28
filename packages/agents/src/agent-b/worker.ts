import { addresses, JobContractAbi } from "@agentrail/shared";
import { publicClient, agentB } from "../lib/wallet.js";
import { hashDeliverable } from "../lib/hash.js";
import { runTask } from "./llm.js";
import { rememberDeliverable } from "./server.js";

/// Listens for JobFunded events targeting Agent B, designs the poster, and submits the
/// deliverable hash on-chain. Member 4.
export function startWorker(): () => void {
  const { account } = agentB();

  const unwatch = publicClient.watchContractEvent({
    address: addresses.JobContract,
    abi: JobContractAbi,
    eventName: "JobFunded",
    onLogs: async (logs) => {
      for (const log of logs) {
        // TODO(M4): blocked on M1 — read the job to confirm the provider is Agent B and to
        //           recover the brief, then submitDeliverable(jobId, hash) via a wallet
        //           client. JobContract reverts until M1 lands.
        void log;
        void account;
        void runTask;
        void hashDeliverable;
        void rememberDeliverable;
        console.log("[agent-b] JobFunded seen — TODO(M4): run + submit.");
      }
    },
    onError: (err) => console.error("[agent-b] worker watch error:", err),
  });

  return unwatch;
}

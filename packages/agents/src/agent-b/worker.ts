import { addresses, JobContractAbi } from "@agentrail/shared";
import { publicClient, agentB } from "../lib/wallet.js";
import { hashDeliverable } from "../lib/hash.js";
import { runTask } from "./llm.js";

/// Listens for JobFunded events targeting Agent B, runs the task via the LLM,
/// and submits the deliverable hash on-chain. Member 4.
export function startWorker(): () => void {
  const { account } = agentB();

  const unwatch = publicClient.watchContractEvent({
    address: addresses.JobContract,
    abi: JobContractAbi,
    eventName: "JobFunded",
    onLogs: async (logs) => {
      for (const log of logs) {
        // TODO(M4): confirm this job's provider is Agent B, then:
        //   const deliverable = await runTask(taskPrompt);
        //   const hash = hashDeliverable(deliverable);
        //   submitDeliverable(jobId, hash) via a wallet client.
        void log;
        void account;
        void runTask;
        void hashDeliverable;
        console.log("[agent-b] JobFunded seen — TODO(M4): run + submit.");
      }
    },
    onError: (err) => console.error("[agent-b] worker watch error:", err),
  });

  return unwatch;
}

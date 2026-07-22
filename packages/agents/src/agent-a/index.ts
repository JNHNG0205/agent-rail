import "dotenv/config";
import { hire } from "./hire.js";
import { review } from "./review.js";
import { approve } from "./approve.js";

/// Agent A (client) entry point. Orchestrates the full client-side flow:
/// hire → wait for the deliverable → review → sign approval → settle. Member 4.
async function main() {
  const agentBUrl = process.env.AGENT_B_URL ?? "http://127.0.0.1:4020";
  console.log("[agent-a] hiring provider at", agentBUrl);

  // TODO(M4): orchestrate the end-to-end flow.
  //   const { jobId } = await hire(agentBUrl);
  //   const { deliverable, onChainHash } = await waitForDeliverable(jobId);
  //   if (await review(deliverable, onChainHash)) await approve(jobId, onChainHash);
  void hire;
  void review;
  void approve;
  console.log("[agent-a] TODO(M4): wire hire → review → approve.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

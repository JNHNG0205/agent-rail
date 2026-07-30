import "dotenv/config";
import { hire } from "./hire.js";

/// Agent A (client) entry point: decide what it needs, hire Agent B, fund the
/// escrow, and stop. Judging and settlement belong to Agent C, the evaluator it
/// names on the job — this agent deliberately cannot approve its own payment.
const GOAL =
  process.env.AGENT_A_GOAL ?? "I need a poster advertising the AgentRail demo day";

async function main() {
  const agentBUrl = process.env.AGENT_B_URL ?? "http://127.0.0.1:4020";
  console.log(`[agent-a] goal: ${GOAL}`);

  const { jobId, brief } = await hire(agentBUrl, GOAL);

  console.log(`[agent-a] done — job ${jobId} is with the provider, graded on:`);
  for (const requirement of brief.requirements) {
    console.log(`[agent-a]   - ${requirement}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

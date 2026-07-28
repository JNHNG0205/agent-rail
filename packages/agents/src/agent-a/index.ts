import "dotenv/config";
import { hire } from "./hire.js";
import { composeBrief } from "./llm.js";

/// Agent A (client) entry point: decide what it needs, hire Agent B, fund the escrow.
/// Judging and settlement belong to Agent C, the assigned evaluator.
const GOAL = "I need a poster advertising the AgentRail demo day";

async function main() {
  const agentBUrl = process.env.AGENT_B_URL ?? "http://127.0.0.1:4020";

  const brief = await composeBrief(GOAL);
  const requirementNoun = brief.requirements.length === 1 ? "requirement" : "requirements";
  console.log(
    "[agent-a] brief:",
    brief.title,
    `(${brief.requirements.length} ${requirementNoun})`,
    `provider=${agentBUrl}`,
  );

  // TODO(M4): blocked on M1 — createJob/fundJob revert until JobContract is implemented.
  void hire;
  console.log("[agent-a] TODO(M4): hire once JobContract is implemented.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

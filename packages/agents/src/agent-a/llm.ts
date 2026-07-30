import type { PosterBrief } from "@agentrail/shared";
import { completeJson } from "../lib/llm.js";

const SYSTEM = `You are a client agent that commissions design work from other agents.

Turn the user's goal into a poster brief. Reply with ONE JSON object and nothing else:
{"title":string,"subtitle":string,"callToAction":string,"palette":string,"requirements":string[]}

Every field must be non-empty. Keep the title short enough to read on a poster.
For "requirements", repeat back exactly the requirements given in the request —
do not invent, reword, add or drop any.`;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPosterBrief(value: unknown): value is PosterBrief {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    isNonEmptyString(v.title) &&
    isNonEmptyString(v.subtitle) &&
    isNonEmptyString(v.callToAction) &&
    isNonEmptyString(v.palette) &&
    Array.isArray(v.requirements) &&
    v.requirements.length > 0 &&
    v.requirements.every(isNonEmptyString)
  );
}

const MOCK_BRIEF: PosterBrief = {
  title: "AgentRail Demo Day",
  subtitle: "Autonomous agents, settled on-chain",
  callToAction: "Join us in the lab",
  palette: "warm terracotta on cream",
  requirements: [
    "shows the title text",
    "shows the subtitle text",
    "shows the call to action",
    "uses a warm terracotta and cream palette",
  ],
};

/// Turn Agent A's goal into the brief it sends Agent B. This is the hire decision.
///
/// `requirements` come from the provider's 402 quote. The model is asked to echo
/// them, but the result is overwritten with the quote's array regardless — the
/// terms the provider advertised must be byte-identical to the terms the
/// evaluator grades against, and that guarantee cannot rest on a model
/// following an instruction.
export async function composeBrief(
  goal: string,
  requirements: string[],
): Promise<PosterBrief> {
  const user = [
    `Goal: ${goal}`,
    "",
    "Requirements (echo these back verbatim):",
    ...requirements.map((r) => `- ${r}`),
  ].join("\n");

  const brief = await completeJson<PosterBrief>(
    { system: SYSTEM, user, mock: { ...MOCK_BRIEF, requirements }, maxTokens: 1000 },
    isPosterBrief,
  );

  return { ...brief, requirements };
}

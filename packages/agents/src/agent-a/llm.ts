import type { PosterBrief } from "@agentrail/shared";
import { completeJson } from "../lib/llm.js";

const SYSTEM = `You are a client agent that commissions design work from other agents.

Turn the user's goal into a poster brief. Reply with ONE JSON object and nothing else:
{"title":string,"subtitle":string,"callToAction":string,"palette":string,"requirements":string[]}

"requirements" are the success criteria the finished poster will be graded against.
Write 3 to 5 of them. Each must be objectively checkable by looking at the poster —
"shows the event date" is checkable, "looks professional" is not.`;

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
export async function composeBrief(goal: string): Promise<PosterBrief> {
  return completeJson<PosterBrief>(
    { system: SYSTEM, user: `Goal: ${goal}`, mock: MOCK_BRIEF, maxTokens: 1000 },
    isPosterBrief,
  );
}

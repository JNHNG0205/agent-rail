import type { DeliverableReview, PosterBrief } from "@agentrail/shared";
import { completeJson } from "../lib/llm.js";

const SYSTEM = `You are an independent evaluator agent. You judge whether delivered work
satisfies the terms it was commissioned under. You did not commission the work and you did
not produce it.

You will be given a brief and the SVG source of the poster that was delivered. Check each
requirement against the SVG source. Reply with ONE JSON object and nothing else:
{"approve":boolean,"reason":string,"presentElements":string[],"missingElements":string[]}

Approve only if every requirement is satisfied. Always give a reason, whether you approve
or reject.`;

export function isDeliverableReview(value: unknown): value is DeliverableReview {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.approve === "boolean" &&
    typeof v.reason === "string" &&
    v.reason.trim().length > 0 &&
    Array.isArray(v.presentElements) &&
    v.presentElements.every((e) => typeof e === "string") &&
    Array.isArray(v.missingElements) &&
    v.missingElements.every((e) => typeof e === "string")
  );
}

function mockReview(brief: PosterBrief): DeliverableReview {
  return {
    approve: true,
    reason: "All requirements are present in the delivered poster.",
    presentElements: [...brief.requirements],
    missingElements: [],
  };
}

/// Judge the deliverable against the brief. Never throws on a bad model reply — a failed
/// review is a normal outcome that leads to refund, not an error.
export async function reviewDeliverable(
  brief: PosterBrief,
  svg: string,
): Promise<DeliverableReview> {
  const user = [
    "Brief:",
    `  Title: ${brief.title}`,
    `  Subtitle: ${brief.subtitle}`,
    `  Call to action: ${brief.callToAction}`,
    `  Palette: ${brief.palette}`,
    "Requirements:",
    ...brief.requirements.map((r) => `  - ${r}`),
    "",
    "Delivered SVG:",
    svg,
  ].join("\n");

  try {
    return await completeJson<DeliverableReview>(
      { system: SYSTEM, user, mock: mockReview(brief), maxTokens: 1500 },
      isDeliverableReview,
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      approve: false,
      reason: `could not obtain a valid review from the provider: ${detail}`,
      presentElements: [],
      missingElements: [...brief.requirements],
    };
  }
}

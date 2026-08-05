import type { DeliverableKind, DeliverableReview, JobBrief } from "@agentrail/shared";
import { hashDeliverable } from "../lib/hash.js";
import { reviewDeliverable } from "./llm.js";

/// Verify the deliverable Agent B served matches what it committed on-chain, then judge it
/// against the brief. The hash gate is deterministic and runs first, so a tampered or stale
/// deliverable is rejected without spending a token.
export async function review(
  brief: JobBrief,
  deliverable: string,
  onChainHash: `0x${string}`,
  kind: DeliverableKind = "svg",
): Promise<DeliverableReview> {
  const localHash = hashDeliverable(deliverable);
  if (localHash.toLowerCase() !== onChainHash.toLowerCase()) {
    return {
      approve: false,
      reason: `deliverable hash ${localHash} does not match the on-chain hash ${onChainHash}`,
      presentElements: [],
      missingElements: [...brief.requirements],
    };
  }
  return reviewDeliverable(brief, deliverable, kind);
}

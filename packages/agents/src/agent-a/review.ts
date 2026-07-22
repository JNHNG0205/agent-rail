import { hashDeliverable } from "../lib/hash.js";

/// Fetch the deliverable Agent B produced and run a structural check: does its
/// keccak256 match the on-chain deliverableHash, and is the content well-formed?
/// Member 4.
export async function review(deliverable: string, onChainHash: `0x${string}`): Promise<boolean> {
  const localHash = hashDeliverable(deliverable);
  const hashMatches = localHash.toLowerCase() === onChainHash.toLowerCase();
  // TODO(M4): add a structural quality check beyond the hash match.
  return hashMatches;
}

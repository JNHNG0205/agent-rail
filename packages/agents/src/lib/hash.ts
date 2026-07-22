import { keccak256, toBytes, type Hex } from "viem";

/// keccak256 of an arbitrary deliverable string — the hash the provider submits
/// on-chain and the client re-derives when reviewing.
export function hashDeliverable(content: string): Hex {
  return keccak256(toBytes(content));
}

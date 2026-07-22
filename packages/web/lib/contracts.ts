import {
  addresses,
  JobContractAbi,
  EvaluatorModuleAbi,
  IdentityRegistryAbi,
  ReputationRegistryAbi,
} from "@agentrail/shared";
import { publicClient } from "./viem";

/// Typed contract handles built from shared ABIs + deployed addresses. Member 3.
export const jobContract = {
  address: addresses.JobContract,
  abi: JobContractAbi,
} as const;

export const evaluatorModule = {
  address: addresses.EvaluatorModule,
  abi: EvaluatorModuleAbi,
} as const;

export const identityRegistry = {
  address: addresses.IdentityRegistry,
  abi: IdentityRegistryAbi,
} as const;

export const reputationRegistry = {
  address: addresses.ReputationRegistry,
  abi: ReputationRegistryAbi,
} as const;

/// Example read helper — extend with the calls the UI needs.
export async function readReputation(agent: `0x${string}`): Promise<bigint> {
  return publicClient.readContract({
    ...reputationRegistry,
    functionName: "reputation",
    args: [agent],
  });
}

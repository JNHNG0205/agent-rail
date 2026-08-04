import {
  addresses,
  JobContractAbi,
  EvaluatorModuleAbi,
  IdentityRegistryAbi,
  ReputationRegistryAbi,
  MockUSDCAbi,
  ZERO_ADDRESS,
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

export const mockUsdc = {
  address: addresses.MockUSDC,
  abi: MockUSDCAbi,
} as const;

/// Helper read functions targeting live chain via viem.
export async function readReputation(agent: `0x${string}`): Promise<bigint> {
  if (!addresses.ReputationRegistry || addresses.ReputationRegistry === ZERO_ADDRESS) {
    return 0n;
  }
  const res = await publicClient.readContract({
    address: addresses.ReputationRegistry,
    abi: ReputationRegistryAbi,
    functionName: "getReputation",
    args: [agent],
  } as never);
  return BigInt(res as string | number | bigint);
}

export async function readJobOnChain(jobId: bigint) {
  if (!addresses.JobContract || addresses.JobContract === ZERO_ADDRESS) {
    return null;
  }
  return publicClient.readContract({
    address: addresses.JobContract,
    abi: JobContractAbi,
    functionName: "getJob",
    args: [jobId],
  } as never);
}

export async function readUsdcBalance(account: `0x${string}`): Promise<bigint> {
  if (!addresses.MockUSDC || addresses.MockUSDC === ZERO_ADDRESS) {
    return 0n;
  }
  const res = await publicClient.readContract({
    address: addresses.MockUSDC,
    abi: MockUSDCAbi,
    functionName: "balanceOf",
    args: [account],
  } as never);
  return BigInt(res as string | number | bigint);
}

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

/// Reputation and USDC balance for many agents, in one request.
///
/// The registry page needed both for every agent, which was two eth_calls each
/// — sixteen for eight agents, on every load, from every open tab. Multicall3
/// aggregates them into a single call, so the cost stops scaling with how many
/// agents exist.
///
/// A failure is per-agent, not per-page: multicall is asked not to revert the
/// batch, so one unreadable address leaves the rest intact rather than emptying
/// the page.
export interface AgentStats {
  reputation: bigint;
  usdcBalance: bigint;
}

export async function readAgentStats(
  agents: readonly `0x${string}`[],
): Promise<Map<string, AgentStats>> {
  const stats = new Map<string, AgentStats>();
  if (agents.length === 0) return stats;

  const hasReputation =
    addresses.ReputationRegistry && addresses.ReputationRegistry !== ZERO_ADDRESS;
  const hasUsdc = addresses.MockUSDC && addresses.MockUSDC !== ZERO_ADDRESS;
  if (!hasReputation && !hasUsdc) return stats;

  const contracts = agents.flatMap((address) => [
    {
      address: addresses.ReputationRegistry,
      abi: ReputationRegistryAbi,
      functionName: "getReputation",
      args: [address],
    },
    {
      address: addresses.MockUSDC,
      abi: MockUSDCAbi,
      functionName: "balanceOf",
      args: [address],
    },
  ]);

  // `as never` on the contracts is how the rest of this file bridges the ABI
  // types; the results are re-typed here rather than left as never so the
  // per-call success check below is real.
  const results = (await publicClient.multicall({
    contracts: contracts as never,
    allowFailure: true,
  })) as unknown as { status: "success" | "failure"; result?: unknown }[];

  agents.forEach((address, i) => {
    const rep = results[i * 2];
    const bal = results[i * 2 + 1];
    stats.set(address.toLowerCase(), {
      reputation: rep?.status === "success" ? BigInt(rep.result as bigint) : 0n,
      usdcBalance: bal?.status === "success" ? BigInt(bal.result as bigint) : 0n,
    });
  });
  return stats;
}

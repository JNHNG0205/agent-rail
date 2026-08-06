// Hand-written accessors over the generated deployments table. Edit freely —
// deploy.ts only rewrites src/deployments.ts.
import type { ContractAddresses } from "./types";
import { CHAIN_ID, CHAIN_META, BASE_SEPOLIA_CHAIN_ID } from "./constants";
import { deployments, deploymentBlocks } from "./deployments";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const UNDEPLOYED: ContractAddresses = {
  MockUSDC: ZERO_ADDRESS,
  JobContract: ZERO_ADDRESS,
  IdentityRegistry: ZERO_ADDRESS,
  ReputationRegistry: ZERO_ADDRESS,
  EvaluatorModule: ZERO_ADDRESS,
};

/// True once deploy.ts has written real addresses for this chain.
export function isDeployed(chainId: number): boolean {
  const entry = deployments[chainId];
  return entry !== undefined && entry.JobContract !== ZERO_ADDRESS;
}

/// Addresses for an explicit chain. Throws with the command to run, so a
/// missing deployment fails loudly rather than sending calls to the zero
/// address and reverting with no useful reason.
export function getAddresses(chainId: number): ContractAddresses {
  const entry = deployments[chainId];
  if (entry === undefined || entry.JobContract === ZERO_ADDRESS) {
    const name = CHAIN_META[chainId]?.name ?? `chain ${chainId}`;
    const cmd =
      chainId === BASE_SEPOLIA_CHAIN_ID ? "npm run deploy:base-sepolia" : "npm run deploy";
    throw new Error(`No AgentRail deployment for ${name} (${chainId}). Run: ${cmd}`);
  }
  return entry;
}

/// Addresses for the active chain (see CHAIN_ID). Falls back to zero addresses
/// rather than throwing, so importing this never breaks a Next.js build on a
/// machine that has not deployed yet. Use getAddresses() where you want a throw.
export const addresses: ContractAddresses = deployments[CHAIN_ID] ?? UNDEPLOYED;

export { deployments, deploymentBlocks };

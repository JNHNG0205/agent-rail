import { createConfig } from "ponder";
import {
  deployments,
  deploymentBlocks,
  isDeployed,
  LOCAL_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  LOCAL_RPC_URL,
  BASE_SEPOLIA_RPC_URL,
  JobContractAbi,
  IdentityRegistryAbi,
  ReputationRegistryAbi,
  EvaluatorModuleAbi,
  MockUSDCAbi,
} from "@agentrail/shared";

/// Chains are built from the generated deployments table rather than hardcoded,
/// so a network nobody has deployed to is simply absent. Listing it anyway would
/// point Ponder at the zero address and index nothing, silently.
const CANDIDATES = [
  {
    name: "local",
    id: LOCAL_CHAIN_ID,
    rpc: process.env.RPC_URL ?? LOCAL_RPC_URL,
    // A local chain resets; Ponder's RPC cache assumes an immutable history and
    // would serve stale blocks from the previous run.
    disableCache: true,
  },
  {
    name: "baseSepolia",
    id: BASE_SEPOLIA_CHAIN_ID,
    rpc: process.env.BASE_SEPOLIA_RPC_URL ?? BASE_SEPOLIA_RPC_URL,
    disableCache: false,
  },
] as const;

const active = CANDIDATES.filter((c) => isDeployed(c.id));

if (active.length === 0) {
  throw new Error(
    "No chain has an AgentRail deployment. Run `npm run deploy` (or deploy:base-sepolia) first.",
  );
}

const chains = Object.fromEntries(
  active.map((c) => [c.name, { id: c.id, rpc: c.rpc, disableCache: c.disableCache }]),
);

/// Per-chain address + startBlock for one contract, across every deployed chain.
function on(contract: keyof (typeof deployments)[number]) {
  return Object.fromEntries(
    active.map((c) => [
      c.name,
      {
        address: deployments[c.id]![contract],
        // Without this the historical sync starts at genesis — seconds locally,
        // millions of empty blocks on a public chain.
        startBlock: deploymentBlocks[c.id] ?? 0,
      },
    ]),
  );
}

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL,
  },
  chains,
  contracts: {
    JobContract: { abi: JobContractAbi, chain: on("JobContract") },
    IdentityRegistry: { abi: IdentityRegistryAbi, chain: on("IdentityRegistry") },
    ReputationRegistry: { abi: ReputationRegistryAbi, chain: on("ReputationRegistry") },
    EvaluatorModule: { abi: EvaluatorModuleAbi, chain: on("EvaluatorModule") },
    // Escrow funding and settlement are USDC transfers — indexing them is how
    // the UI shows money actually moving.
    MockUSDC: { abi: MockUSDCAbi, chain: on("MockUSDC") },
  },
});

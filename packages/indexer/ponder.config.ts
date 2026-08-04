import { createConfig } from "ponder";
import {
  deployments,
  deploymentBlocks,
  isDeployed,
  CHAIN_ID,
  CHAIN_META,
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
    // Deliberately NOT BASE_SEPOLIA_RPC_URL, which the agents use.
    //
    // The indexer's workload is the opposite of theirs. Agents send a handful of
    // transactions and need a node that answers consistently, so a private
    // endpoint is right for them. The indexer reads logs in bulk, and there the
    // limit that matters is the eth_getLogs block range: Alchemy's free tier
    // caps it at 10 blocks, while the public endpoint serves 1000. Over a
    // 200k-block history that is 20,000 requests against 200 — and the 20,000
    // exceed the free tier's compute units per second, so the backfill stalls
    // part-way with 429s and never finishes.
    //
    // Set BASE_SEPOLIA_INDEXER_RPC_URL to override, which is worth doing on a
    // paid plan where the range cap is lifted.
    rpc: process.env.BASE_SEPOLIA_INDEXER_RPC_URL ?? BASE_SEPOLIA_RPC_URL,
    disableCache: false,
  },
] as const;

/// Index exactly the chain the rest of the stack is pointed at.
///
/// Indexing every deployed chain at once corrupts the data rather than merely
/// showing too much of it: `job` is keyed by jobId alone and `agent` by address
/// alone, so local job 0 and Base Sepolia job 0 are the same row and whichever
/// syncs last overwrites the other. A local demo was serving testnet jobs
/// through /api/jobs for exactly this reason.
///
/// CHAIN_ID already selects the chain for the agents, the web app and the
/// deployment table, so following it here makes the indexer consistent with
/// everything else instead of being the one component with its own idea of
/// which network is live.
const active = CANDIDATES.filter((c) => c.id === CHAIN_ID && isDeployed(c.id));

if (active.length === 0) {
  const name = CHAIN_META[CHAIN_ID]?.name ?? `chain ${CHAIN_ID}`;
  throw new Error(
    `No AgentRail deployment on ${name} (CHAIN_ID=${CHAIN_ID}). ` +
      `Deploy to it first, or set CHAIN_ID to a chain that has one.`,
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

import "dotenv/config";
import { createPublicClient, http } from "viem";
import {
  getAddresses,
  JobContractAbi,
  IdentityRegistryAbi,
  ReputationRegistryAbi,
  CHAIN_ID,
  CHAIN_NAME,
  RPC_URL,
} from "@agentrail/shared";
import { handleJobEvent } from "./handlers/jobEvents.js";
import { handleRegistryEvent } from "./handlers/registryEvents.js";

/// Subscribes to every AgentRail contract event and upserts it into Postgres.
/// The DB is a read cache; the chain remains the source of truth.
async function main() {
  const client = createPublicClient({ transport: http(RPC_URL) });

  // Throw rather than silently watching the zero address on an undeployed chain.
  const addresses = getAddresses(CHAIN_ID);

  console.log(`[indexer] ${CHAIN_NAME} (${CHAIN_ID}) via ${RPC_URL}`);
  console.log("[indexer] watching contracts:", addresses);

  const unwatchJobs = client.watchContractEvent({
    address: addresses.JobContract,
    abi: JobContractAbi,
    onLogs: (logs) => logs.forEach(handleJobEvent),
    onError: (err) => console.error("[indexer] job watch error:", err),
  });

  const unwatchIdentity = client.watchContractEvent({
    address: addresses.IdentityRegistry,
    abi: IdentityRegistryAbi,
    onLogs: (logs) => logs.forEach(handleRegistryEvent),
    onError: (err) => console.error("[indexer] identity watch error:", err),
  });

  const unwatchReputation = client.watchContractEvent({
    address: addresses.ReputationRegistry,
    abi: ReputationRegistryAbi,
    onLogs: (logs) => logs.forEach(handleRegistryEvent),
    onError: (err) => console.error("[indexer] reputation watch error:", err),
  });

  const shutdown = () => {
    unwatchJobs();
    unwatchIdentity();
    unwatchReputation();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

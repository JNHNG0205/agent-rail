import type { Log } from "viem";

/// Handles AgentRegistered / ReputationUpdated: upsert the `agents` row and
/// append to `events`. Member 4.
export async function handleRegistryEvent(log: Log): Promise<void> {
  // TODO(M4): decode `log`. On AgentRegistered upsert agents(address, token_id,
  //           name, registered_at); on ReputationUpdated update reputation.
  const eventName = (log as { eventName?: string }).eventName ?? "unknown";
  console.log("[indexer] registry event:", eventName, log.transactionHash);
}

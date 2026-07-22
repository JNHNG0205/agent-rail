import type { Log } from "viem";

/// Handles JobCreated / JobFunded / DeliverableSubmitted / JobCompleted /
/// JobCancelled: upsert the `jobs` row and append to `events`. Member 4.
export async function handleJobEvent(log: Log): Promise<void> {
  // TODO(M4): decode `log`, upsert jobs(id, client, provider, amount, state,
  //           deliverable_hash, created_block, updated_at), insert into events.
  //           Derive `state` from the event name (Funded/Submitted/Terminal).
  const eventName = (log as { eventName?: string }).eventName ?? "unknown";
  console.log("[indexer] job event:", eventName, log.transactionHash);
}

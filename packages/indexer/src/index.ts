import { ponder } from "ponder:registry";
import { agent, job, event, transfer } from "ponder:schema";

/// Indexing functions. Ponder handles backfill, reorgs and checkpointing; what
/// lives here is only the domain logic — which event means which state, and what
/// the projection should look like afterwards.

type EventContext = {
  id: string;
  chainId: number;
  txHash: `0x${string}`;
  logIndex: number;
  blockNumber: bigint;
  blockTimestamp: bigint;
};

/// Every log lands in the append-only feed as well as its projection, so the UI
/// can show what happened, not just where things ended up.
function logContext(ev: {
  id: string;
  log: { logIndex: number };
  transaction: { hash: `0x${string}` };
  block: { number: bigint; timestamp: bigint };
}): EventContext {
  return {
    id: ev.id,
    chainId: 0, // overwritten below from context
    txHash: ev.transaction.hash,
    logIndex: ev.log.logIndex,
    blockNumber: ev.block.number,
    blockTimestamp: ev.block.timestamp,
  };
}

async function recordEvent(
  context: { db: any; chain: { id: number } },
  ev: Parameters<typeof logContext>[0],
  contract: string,
  eventName: string,
  jobId: bigint | null,
  args: unknown,
) {
  const c = logContext(ev);
  await context.db.insert(event).values({
    id: c.id,
    chainId: context.chain.id,
    contract,
    eventName,
    jobId,
    txHash: c.txHash,
    logIndex: c.logIndex,
    blockNumber: c.blockNumber,
    blockTimestamp: c.blockTimestamp,
    // bigints cannot be serialised to JSON — stringify before they reach jsonb.
    args: JSON.parse(JSON.stringify(args, (_k, v) => (typeof v === "bigint" ? v.toString() : v))),
  });
}

// ─── IdentityRegistry ────────────────────────────────────────────────────────

ponder.on("IdentityRegistry:AgentRegistered", async ({ event: ev, context }) => {
  await context.db
    .insert(agent)
    .values({
      address: ev.args.agent,
      tokenId: ev.args.tokenId,
      reputation: 0n,
      registeredAt: ev.block.timestamp,
    })
    .onConflictDoUpdate(() => ({ tokenId: ev.args.tokenId, registeredAt: ev.block.timestamp }));

  await recordEvent(context, ev, "IdentityRegistry", "AgentRegistered", null, ev.args);
});

// ─── ReputationRegistry ──────────────────────────────────────────────────────

ponder.on("ReputationRegistry:ReputationUpdated", async ({ event: ev, context }) => {
  // The agent may not be registered yet — separate contracts give no ordering
  // guarantee — so insert a bare row rather than losing the score.
  await context.db
    .insert(agent)
    .values({ address: ev.args.agent, reputation: ev.args.newScore })
    .onConflictDoUpdate(() => ({ reputation: ev.args.newScore }));

  await recordEvent(context, ev, "ReputationRegistry", "ReputationUpdated", null, ev.args);
});

// ─── JobContract ─────────────────────────────────────────────────────────────

ponder.on("JobContract:JobCreated", async ({ event: ev, context }) => {
  await context.db.insert(job).values({
    id: ev.args.jobId,
    client: ev.args.client,
    provider: ev.args.provider,
    evaluator: ev.args.evaluator,
    amount: ev.args.amount,
    state: "Open",
    deliverableHash: null,
    outcome: null,
    createdBlock: ev.block.number,
    updatedBlock: ev.block.number,
  });

  await recordEvent(context, ev, "JobContract", "JobCreated", ev.args.jobId, ev.args);
});

ponder.on("JobContract:JobFunded", async ({ event: ev, context }) => {
  await context.db
    .update(job, { id: ev.args.jobId })
    .set({ state: "Funded", updatedBlock: ev.block.number });

  await recordEvent(context, ev, "JobContract", "JobFunded", ev.args.jobId, ev.args);
});

ponder.on("JobContract:DeliverableSubmitted", async ({ event: ev, context }) => {
  await context.db.update(job, { id: ev.args.jobId }).set({
    state: "Submitted",
    deliverableHash: ev.args.deliverableHash,
    updatedBlock: ev.block.number,
  });

  await recordEvent(
    context,
    ev,
    "JobContract",
    "DeliverableSubmitted",
    ev.args.jobId,
    ev.args,
  );
});

// Terminal covers three different endings. `state` alone cannot tell them
// apart, so `outcome` records which one actually happened.
ponder.on("JobContract:JobCompleted", async ({ event: ev, context }) => {
  await context.db
    .update(job, { id: ev.args.jobId })
    .set({ state: "Terminal", outcome: "completed", updatedBlock: ev.block.number });

  await recordEvent(context, ev, "JobContract", "JobCompleted", ev.args.jobId, ev.args);
});

ponder.on("JobContract:JobCancelled", async ({ event: ev, context }) => {
  await context.db
    .update(job, { id: ev.args.jobId })
    .set({ state: "Terminal", outcome: "cancelled", updatedBlock: ev.block.number });

  await recordEvent(context, ev, "JobContract", "JobCancelled", ev.args.jobId, ev.args);
});

ponder.on("JobContract:JobTimeoutClaimed", async ({ event: ev, context }) => {
  await context.db
    .update(job, { id: ev.args.jobId })
    .set({ state: "Terminal", outcome: "timeoutClaimed", updatedBlock: ev.block.number });

  await recordEvent(context, ev, "JobContract", "JobTimeoutClaimed", ev.args.jobId, ev.args);
});

// ─── EvaluatorModule ─────────────────────────────────────────────────────────

ponder.on("EvaluatorModule:ApprovalProcessed", async ({ event: ev, context }) => {
  await recordEvent(
    context,
    ev,
    "EvaluatorModule",
    "ApprovalProcessed",
    ev.args.jobId,
    ev.args,
  );
});

// ─── MockUSDC ────────────────────────────────────────────────────────────────

ponder.on("MockUSDC:Transfer", async ({ event: ev, context }) => {
  await context.db.insert(transfer).values({
    id: ev.id,
    from: ev.args.from,
    to: ev.args.to,
    value: ev.args.value,
    blockNumber: ev.block.number,
    txHash: ev.transaction.hash,
  });
});

import { onchainTable, index } from "ponder";

/// The read-cache model. The chain stays the source of truth; if this disagrees
/// with it, the chain wins and the cache is rebuilt.
///
/// Ponder owns these tables and handles what the hand-rolled version would have
/// had to: dedupe on reorg, resume from a checkpoint, backfill from startBlock.
/// So there is no unique constraint on (txHash, logIndex) here — Ponder's
/// reorg reconciliation is what that constraint was standing in for.

/// One row per registered agent. `name` is not on-chain: registerAgent takes
/// only an address, so the display label is resolved by the UI via agentLabel().
export const agent = onchainTable("agent", (t) => ({
  address: t.hex().primaryKey(),
  tokenId: t.bigint(),
  reputation: t.bigint().notNull().default(0n),
  registeredAt: t.bigint(),
}));

/// Current state of each job, projected from the events below.
export const job = onchainTable(
  "job",
  (t) => ({
    id: t.bigint().primaryKey(),
    client: t.hex().notNull(),
    provider: t.hex().notNull(),
    evaluator: t.hex().notNull(),
    amount: t.bigint().notNull(),
    // Open | Funded | Submitted | Terminal — the label, matching JobStateLabel.
    state: t.text().notNull(),
    deliverableHash: t.hex(),
    // How the job ended, since Terminal covers three outcomes that the state
    // alone cannot distinguish: completed, cancelled, or claimed on timeout.
    outcome: t.text(),
    createdBlock: t.bigint().notNull(),
    updatedBlock: t.bigint().notNull(),
  }),
  (table) => ({
    // /agents/[address] lists an agent's jobs across all three of its roles.
    clientIdx: index().on(table.client),
    providerIdx: index().on(table.provider),
    evaluatorIdx: index().on(table.evaluator),
  }),
);

/// Append-only decoded log — the audit trail the UI's transaction feed renders.
/// Ordered by (blockNumber, logIndex), which is true chain order; a timestamp
/// ties within a block and misorders entirely during a backfill.
export const event = onchainTable(
  "event",
  (t) => ({
    id: t.text().primaryKey(), // `${txHash}-${logIndex}`
    chainId: t.integer().notNull(),
    contract: t.text().notNull(),
    eventName: t.text().notNull(),
    jobId: t.bigint(),
    txHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
    args: t.json(),
  }),
  (table) => ({
    jobIdx: index().on(table.jobId),
    blockIdx: index().on(table.blockNumber),
  }),
);

/// USDC movements. Escrow funding and settlement are transfers, so this is how
/// the UI shows the money actually moving rather than just job state changing.
export const transfer = onchainTable(
  "transfer",
  (t) => ({
    id: t.text().primaryKey(), // `${txHash}-${logIndex}`
    from: t.hex().notNull(),
    to: t.hex().notNull(),
    value: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    fromIdx: index().on(table.from),
    toIdx: index().on(table.to),
  }),
);

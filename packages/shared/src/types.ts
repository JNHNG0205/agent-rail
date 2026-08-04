// Shared domain types. Keep in sync with JobContract.sol and the DB schema.

/// Mirrors JobContract.JobState (enum order matters — index === on-chain value).
export enum JobState {
  Open = 0,
  Funded = 1,
  Submitted = 2,
  Terminal = 3,
}

export type JobStateLabel = "Open" | "Funded" | "Submitted" | "Terminal";

export const JOB_STATE_LABELS: Record<JobState, JobStateLabel> = {
  [JobState.Open]: "Open",
  [JobState.Funded]: "Funded",
  [JobState.Submitted]: "Submitted",
  [JobState.Terminal]: "Terminal",
};

/// The jobs table stores the label, not the enum ordinal. The indexer needs
/// enum -> label on write; toJob() needs label -> enum on read.
export const JOB_STATE_BY_LABEL: Record<JobStateLabel, JobState> = {
  Open: JobState.Open,
  Funded: JobState.Funded,
  Submitted: JobState.Submitted,
  Terminal: JobState.Terminal,
};

/// Terminal covers three different endings that `state` alone cannot tell
/// apart, so the indexer records which one happened.
export type JobOutcome = "completed" | "cancelled" | "timeoutClaimed";

/// A row from GET /api/agents. Every numeric column arrives as a string —
/// Postgres returns `numeric` that way to avoid precision loss.
///
/// There is deliberately no `name`: IdentityRegistry.registerAgent takes only an
/// address and stores no label, so nothing on-chain carries one. Resolve it in
/// the UI with agentLabel(address).
export interface Agent {
  address: `0x${string}`;
  tokenId: string | null;
  reputation: string;
  registeredAt: string | null; // block timestamp, seconds
}

/// Domain shape — what the chain gives you. The indexer builds this from
/// decoded viem events, where amounts really are bigint.
export interface Job {
  id: bigint; // on-chain job id
  client: `0x${string}`;
  provider: `0x${string}`;
  evaluator: `0x${string}`; // signs the decision that settles or refunds
  amount: bigint; // USDC minor units (6 decimals)
  state: JobState;
  deliverableHash: `0x${string}` | null;
  outcome: JobOutcome | null;
  createdBlock: bigint;
  updatedBlock: bigint;
}

/// Wire shape — exactly what GET /api/jobs returns. JSON cannot represent a
/// bigint, so every Postgres `numeric` arrives as a string and `state` as its
/// label. Parse with toJob() only where you need arithmetic; to display an
/// amount, formatUsdc(BigInt(row.amount)) is enough.
export interface JobRow {
  id: string;
  client: `0x${string}`;
  provider: `0x${string}`;
  evaluator: `0x${string}`;
  amount: string;
  state: JobStateLabel;
  deliverableHash: `0x${string}` | null;
  outcome: JobOutcome | null;
  createdBlock: string;
  updatedBlock: string;
}

export function toJob(row: JobRow): Job {
  return {
    id: BigInt(row.id),
    client: row.client,
    provider: row.provider,
    evaluator: row.evaluator,
    amount: BigInt(row.amount),
    state: JOB_STATE_BY_LABEL[row.state],
    deliverableHash: row.deliverableHash,
    outcome: row.outcome,
    createdBlock: BigInt(row.createdBlock),
    updatedBlock: BigInt(row.updatedBlock),
  };
}

/// Deployed address set for one chain. Lives here rather than in addresses.ts
/// so the generated deployments.ts can import it without a circular reference.
export interface ContractAddresses {
  MockUSDC: `0x${string}`;
  JobContract: `0x${string}`;
  IdentityRegistry: `0x${string}`;
  ReputationRegistry: `0x${string}`;
  EvaluatorModule: `0x${string}`;
}

export type ContractName = keyof ContractAddresses;

/// Poster commission terms. Travels inside Agent B's 402 quote, so it must live
/// in shared — it crosses the HTTP boundary between agents.
export interface PosterBrief {
  title: string;
  subtitle: string;
  callToAction: string;
  palette: string;
  requirements: string[];
}

/// Agent C's verdict. `reason` is populated on approval and rejection alike.
export interface DeliverableReview {
  approve: boolean;
  reason: string;
  presentElements: string[];
  missingElements: string[];
}

/// Wire shape for GET /api/events. Wire-only — nothing builds a domain version
/// of an event, so unlike Job there is no bigint counterpart. `blockNumber` is
/// a string for the same reason as JobRow: BIGINT does not survive JSON.
export interface ChainEvent {
  id: string; // `${txHash}-${logIndex}`
  chainId: number;
  contract: string;
  eventName: string;
  jobId: string | null;
  txHash: `0x${string}`;
  logIndex: number; // position within the tx; with blockNumber gives chain order
  blockNumber: string;
  blockTimestamp: string; // seconds
  args: Record<string, unknown>;
}

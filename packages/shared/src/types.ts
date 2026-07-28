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

export interface Agent {
  address: `0x${string}`;
  tokenId: number | null;
  name: string;
  reputation: number;
  registeredAt: string | null; // ISO timestamp
}

/// Domain shape — what the chain gives you. The indexer builds this from
/// decoded viem events, where amounts really are bigint.
export interface Job {
  id: number; // on-chain job id
  client: `0x${string}`;
  provider: `0x${string}`;
  evaluator: `0x${string}`; // signs the approval that settles the job
  amount: bigint; // USDC minor units (6 decimals)
  state: JobState;
  deliverableHash: `0x${string}` | null;
  createdBlock: bigint;
  updatedAt: string | null; // ISO timestamp
}

/// Wire shape — exactly what GET /api/jobs returns. JSON cannot represent a
/// bigint, so Postgres NUMERIC and BIGINT arrive as strings and `state` as its
/// label. Parse with toJob() only where you need arithmetic; to display an
/// amount, formatUsdc(BigInt(row.amount)) is enough.
export interface JobRow {
  id: number;
  client: `0x${string}`;
  provider: `0x${string}`;
  evaluator: `0x${string}`;
  amount: string;
  state: JobStateLabel;
  deliverableHash: `0x${string}` | null;
  createdBlock: string;
  updatedAt: string | null;
}

export function toJob(row: JobRow): Job {
  return {
    id: row.id,
    client: row.client,
    provider: row.provider,
    evaluator: row.evaluator,
    amount: BigInt(row.amount),
    state: JOB_STATE_BY_LABEL[row.state],
    deliverableHash: row.deliverableHash,
    createdBlock: BigInt(row.createdBlock),
    updatedAt: row.updatedAt,
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
  id: number;
  contract: string;
  eventName: string;
  jobId: number | null;
  txHash: `0x${string}`;
  blockNumber: string;
  logIndex: number; // position within the tx; with blockNumber gives chain order
  args: Record<string, unknown>;
  createdAt: string; // ISO timestamp
}

// Shared domain types. Keep in sync with JobContract.sol and the DB schema.

/// Mirrors JobContract.JobState (enum order matters — index === on-chain value).
export enum JobState {
  Open = 0,
  Funded = 1,
  Submitted = 2,
  Terminal = 3,
}

export const JOB_STATE_LABELS: Record<JobState, string> = {
  [JobState.Open]: "Open",
  [JobState.Funded]: "Funded",
  [JobState.Submitted]: "Submitted",
  [JobState.Terminal]: "Terminal",
};

export interface Agent {
  address: `0x${string}`;
  tokenId: number | null;
  name: string;
  reputation: number;
  registeredAt: string | null; // ISO timestamp
}

export interface Job {
  id: number; // on-chain job id
  client: `0x${string}`;
  provider: `0x${string}`;
  evaluator: `0x${string}`; // signs the approval that settles the job
  amount: bigint; // USDC minor units (6 decimals)
  state: JobState;
  deliverableHash: `0x${string}` | null;
  createdBlock: number;
  updatedAt: string | null; // ISO timestamp
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

export interface ChainEvent {
  id: number;
  contract: string;
  eventName: string;
  jobId: number | null;
  txHash: `0x${string}`;
  blockNumber: number;
  args: Record<string, unknown>;
  createdAt: string; // ISO timestamp
}

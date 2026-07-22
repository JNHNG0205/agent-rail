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
  amount: bigint; // USDC minor units (6 decimals)
  state: JobState;
  deliverableHash: `0x${string}` | null;
  createdBlock: number;
  updatedAt: string | null; // ISO timestamp
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

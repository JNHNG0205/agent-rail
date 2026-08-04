import { formatUsdc as sharedFormatUsdc } from "@agentrail/shared";

export type JobStep = "Open" | "Funded" | "Submitted" | "Terminal";
export const JOB_STEPS: JobStep[] = ["Open", "Funded", "Submitted", "Terminal"];

export interface Agent {
  address: `0x${string}`;
  label: string;
  name: string;
  role: "Buyer" | "Provider" | "Worker" | "Evaluator";
  identityTokenId: number;
  tokenId: number;
  reputation: number;
  reputationJobs: number;
  completedJobs: number;
  ratingAverage: number;
  specialty: string;
  attestations: number;
  usdcBalance: number | bigint;
}

export interface RegisteredAgent extends Agent {}

export interface Job {
  id: string;
  jobId: string;
  title: string;
  client: `0x${string}`;
  provider: `0x${string}`;
  evaluator: `0x${string}`;
  buyer: string;
  worker: string;
  amount: number | bigint;
  escrowAmount: number | bigint;
  status: JobStep;
  step: 1 | 2 | 3 | 4;
  currentStep: JobStep;
  deliverableHash: `0x${string}`;
  signature: string;
  block: string | number;
  createdAt: string;
  updatedAt: string;
}

export interface JobItem extends Job {}

export interface ActivityEvent {
  id: string;
  txHash: `0x${string}`;
  type: "JobCreated" | "EscrowFunded" | "WorkSubmitted" | "JobCompleted" | "JobCancelled";
  eventName?: string;
  details: string;
  description: string;
  formattedAmount?: string;
  timestamp: string;
  timeAgo: string;
}

export interface RailEvent extends ActivityEvent {}

export const CONNECTED_WALLET = {
  address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`,
};

export function truncateHex(hex?: string, start = 6, end = 4): string {
  if (!hex) return "";
  if (hex.length <= start + end) return hex;
  return `${hex.slice(0, start)}...${hex.slice(-end)}`;
}

export function formatUsdc(amount?: number | bigint): string {
  if (amount === undefined) return "$0.00 USDC";
  if (typeof amount === "bigint") {
    return `${sharedFormatUsdc(amount)} USDC`;
  }
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC`;
}

export function pseudoKeccak(input: string): `0x${string}` {
  let hash = 0n;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5n) - hash + BigInt(input.charCodeAt(i));
    hash = hash & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;
  }
  const hex = hash.toString(16).padStart(64, "0");
  return `0x${hex}`;
}

export const REGISTERED_AGENTS: RegisteredAgent[] = [
  {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    label: "Agent A (Poster)",
    name: "Agent A (Poster)",
    role: "Buyer",
    identityTokenId: 1,
    tokenId: 1,
    reputation: 98,
    reputationJobs: 42,
    completedJobs: 42,
    ratingAverage: 4.9,
    specialty: "Task Poster & Escrow Funder",
    attestations: 12,
    usdcBalance: 500000000n,
  },
  {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    label: "Agent B (Worker)",
    name: "Agent B (Worker)",
    role: "Provider",
    identityTokenId: 2,
    tokenId: 2,
    reputation: 95,
    reputationJobs: 38,
    completedJobs: 38,
    ratingAverage: 4.8,
    specialty: "SVG Banner Design & Content Generation",
    attestations: 9,
    usdcBalance: 120000000n,
  },
  {
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    label: "Agent C (Evaluator)",
    name: "Agent C (Evaluator)",
    role: "Evaluator",
    identityTokenId: 3,
    tokenId: 3,
    reputation: 100,
    reputationJobs: 150,
    completedJobs: 150,
    ratingAverage: 5.0,
    specialty: "ERC-7579 Verification & Signature Scoring",
    attestations: 24,
    usdcBalance: 350000000n,
  },
];

export const AGENTS: Agent[] = REGISTERED_AGENTS;

export const JOBS: Job[] = [
  {
    id: "1",
    jobId: "1",
    title: "Generate Marketing Banner SVG",
    client: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    provider: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    evaluator: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    buyer: "Agent A (Poster)",
    worker: "Agent B (Worker)",
    amount: 10000000n,
    escrowAmount: 10000000n,
    status: "Funded",
    step: 2,
    currentStep: "Funded",
    deliverableHash: "0xa3f28d1c9b8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a",
    signature: "0xf3a9c2e8f3a9c2e8f3a9c2e8f3a9c2e8b7d6a5f4b7d6a5f4b7d6a5f4b7d6a5f41c",
    block: 1042,
    createdAt: "2026-08-04T10:00:00Z",
    updatedAt: "2026-08-04T10:05:00Z",
  },
];

export const ACTIVE_JOB: Job = JOBS[0];

export const METRICS = {
  totalEscrowed: 0n,
  totalEscrowUsdc: "0.00 USDC",
  activeJobs: "0",
  activeJobsCount: "0",
  settledJobsCount: "0",
};

export const EVENTS: ActivityEvent[] = [
  {
    id: "evt-1",
    txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    type: "EscrowFunded",
    eventName: "JobFunded",
    details: "Job #1 funded with 10.000000 USDC",
    description: "Job #1 funded with 10.000000 USDC",
    formattedAmount: "10.000000 USDC",
    timestamp: "10:05 AM",
    timeAgo: "5m ago",
  },
];

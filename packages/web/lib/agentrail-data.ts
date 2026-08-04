import { formatUsdc as sharedFormatUsdc } from "@agentrail/shared";

/// Shared display types and formatters for the dashboard.
///
/// Every field here must be something the system can actually produce — from the
/// indexed tables, from a chain read, or from the agent runtime. Fields that
/// looked plausible but had no source (a star rating, an attestation count, a
/// "specialty") are gone, along with the sample agents, jobs and events that
/// used to stand in when live data was empty.
///
/// The reason is not tidiness. A dashboard that invents numbers when it has none
/// is indistinguishable from one reporting real ones, so nobody can tell which
/// they are looking at — including the person demonstrating it. An empty state
/// is honest; a fabricated 4.9 rating is not.

export type JobStep = "Open" | "Funded" | "Submitted" | "Terminal";
export const JOB_STEPS: JobStep[] = ["Open", "Funded", "Submitted", "Terminal"];

/// A registered agent, as far as the chain and the runtime know it.
///
/// `name`, `role` and `service` come from the runtime and are absent for an
/// identity it does not host — a registration with nobody running it, which is a
/// real state worth being able to see.
export interface Agent {
  address: `0x${string}`;
  /// Short label for display. From the runtime where it hosts the agent, else
  /// agentLabel() for the seeded three, else a truncated address.
  label: string;
  name: string;
  role: "client" | "provider" | "evaluator" | "unknown";
  /// Identity token id from IdentityRegistry. Absent until indexed.
  tokenId?: number;
  /// Completed jobs, counted by ReputationRegistry.
  reputation: number;
  usdcBalance?: bigint;
  /// What this agent sells, when the runtime hosts it.
  service?: { summary: string; priceUsdc: string; requirements: string[] } | null;
}

export interface Job {
  id: string;
  client: `0x${string}`;
  provider: `0x${string}`;
  evaluator: `0x${string}`;
  amount: bigint;
  status: JobStep;
  /// Terminal collapses three endings; this is which one happened.
  outcome: "completed" | "cancelled" | "timeoutClaimed" | null;
  deliverableHash: `0x${string}` | null;
}

export interface ActivityEvent {
  id: string;
  txHash: `0x${string}`;
  eventName: string;
  contract: string;
  jobId: string | null;
  blockNumber: string;
}

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

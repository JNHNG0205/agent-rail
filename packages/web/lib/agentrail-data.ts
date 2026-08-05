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
  /// The runtime's id for this agent, when the runtime hosts it. Absent for a
  /// registration that exists on chain with nobody running it — which is also
  /// exactly when it cannot be acted on.
  id?: string;
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
  /// Who created it, when the runtime hosts it. Null for agents that predate
  /// ownership, and absent for a registration the runtime does not host at all.
  createdBy?: string | null;
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

/// An amount as a person reads it: two decimal places, no unit.
///
/// Display only. Six decimals is what USDC stores and what the chain moves, and
/// it is right for a hash or a receipt and wrong for a balance someone is
/// scanning — "7.50" is the number they think in.
///
/// It deliberately does NOT append "USDC". It used to, and the unit then
/// appeared twice wherever a caller added its own; worse, two places passed the
/// result back as a transaction amount, where a trailing " USDC" is rejected by
/// parseUsdc and a rounded figure would quietly move less money than intended.
/// Anything that feeds a value back into a transaction must use the exact
/// six-decimal formatter from shared, never this one.
export function formatUsdc(amount?: number | bigint): string {
  if (amount === undefined) return "0.00";
  const minorUnits = typeof amount === "bigint" ? amount : BigInt(Math.round(amount * 1e6));
  // Truncated, never rounded. Rounding 0.999999 to "1.00" shows a balance
  // larger than the one that exists, and an amount displayed as more than it is
  // is the one direction this must never move. Truncation can only ever
  // understate, which is safe: the exact figure is a click away and the money
  // itself is untouched — only the number of places shown changes.
  const cents = minorUnits / 10_000n;
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

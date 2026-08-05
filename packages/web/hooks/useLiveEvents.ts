"use client";

import { useCallback, useEffect, useState } from "react";
import { formatUsdc, type ChainEvent } from "@agentrail/shared";

/// The event feed, read from the indexer rather than the chain. Member 4.
///
/// This used viem's watchContractEvent, which over an HTTP transport is not a
/// subscription at all — it polls eth_getLogs every four seconds. Two hooks did
/// it, so an idle browser tab issued about 1,800 getLogs an hour, one of the
/// most expensive methods an RPC provider bills, multiplied by every open tab.
/// It exhausted a day's quota on a free tier without anyone touching the page,
/// which then blocked the agents from registering or settling at all.
///
/// The indexer already ingests every event into Postgres — that is its whole
/// job. One indexer polling once is the design; N browsers each polling the
/// chain forever is that work repeated per viewer and billed per viewer. So the
/// browser reads what has already been collected, and the page keeps working
/// while the RPC endpoint is throttled, because Postgres is not rate limited.

export interface FormattedEvent {
  id: string;
  eventName: string;
  jobId?: string;
  txHash: `0x${string}`;
  formattedAmount?: string;
  details: string;
  timestamp: Date;
}

/// How often to ask the indexer. Slower than the old chain poll and far cheaper:
/// a query against a local table, not a billed archival log scan.
const POLL_MS = 5_000;

function usdcFrom(args: Record<string, unknown>): string | undefined {
  // Amounts arrive as strings — JSON has no bigint — and are minor units, so
  // they go through BigInt rather than Number, which loses precision above 2^53
  // and is the wrong type for money regardless.
  const raw = args.amount ?? args.refund;
  if (typeof raw !== "string" && typeof raw !== "number") return undefined;
  try {
    return `${formatUsdc(BigInt(raw))} USDC`;
  } catch {
    return undefined;
  }
}

function describe(eventName: string, jobId: string | undefined, amount?: string): string {
  switch (eventName) {
    case "JobCreated":
      return `Job #${jobId} created with ${amount ?? "0 USDC"}`;
    case "JobFunded":
      return `Job #${jobId} funded with ${amount ?? "0 USDC"}`;
    case "DeliverableSubmitted":
    case "WorkSubmitted":
      return `Deliverable submitted for Job #${jobId}`;
    case "JobCompleted":
      return `Job #${jobId} settled and completed (${amount ?? "0 USDC"})`;
    case "JobCancelled":
      return `Job #${jobId} cancelled. Refunded ${amount ?? "0 USDC"}`;
    default:
      return `Event: ${eventName}`;
  }
}

function toFormatted(row: ChainEvent): FormattedEvent {
  const args = (row.args ?? {}) as Record<string, unknown>;
  const jobId = row.jobId != null ? String(row.jobId) : undefined;
  const formattedAmount = usdcFrom(args);
  return {
    id: row.id,
    eventName: row.eventName,
    jobId,
    txHash: row.txHash as `0x${string}`,
    formattedAmount,
    details: describe(row.eventName, jobId, formattedAmount),
    // The block's time, not the browser's. A backfilled event is not something
    // that just happened, and stamping it with now() reorders the feed.
    timestamp: new Date(Number(row.blockTimestamp) * 1000),
  };
}

export function useLiveEvents() {
  const [rows, setRows] = useState<ChainEvent[]>([]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) return;
      setRows((await res.json()) as ChainEvent[]);
    } catch {
      // The indexer being briefly unreachable is not worth surfacing here: the
      // feed simply does not advance, and the next poll picks it up.
    }
  }, []);

  useEffect(() => {
    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  // `latestId` is the change signal, not the count. The feed is capped at the
  // most recent events, so once that cap is reached the length never moves
  // again — a caller refetching on length would silently stop refetching.
  // Newest first: the route orders by chain position rather than by insertion,
  // because one settle emits three events in a single block.
  return { logs: rows, events: rows.map(toFormatted), latestId: rows[0]?.id ?? null };
}

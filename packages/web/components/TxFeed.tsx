"use client";

import { useJobEvents } from "@/hooks/useJobEvents";

/// Live transaction feed driven by on-chain events. Member 3.
export function TxFeed({ jobId }: { jobId?: number }) {
  const events = useJobEvents();

  if (events.length === 0) {
    return <p style={{ color: "var(--muted)" }}>Waiting for on-chain events…</p>;
  }

  return (
    <ul style={{ listStyle: "none", padding: 0, fontFamily: "ui-monospace, monospace", fontSize: "0.8rem" }}>
      {events.map((log, i) => (
        <li key={`${log.transactionHash}-${i}`} style={{ padding: "0.25rem 0" }}>
          {(log as { eventName?: string }).eventName ?? "event"} · {log.transactionHash?.slice(0, 10)}…
        </li>
      ))}
    </ul>
  );
  // TODO(M3): filter by `jobId` once event args are decoded.
}

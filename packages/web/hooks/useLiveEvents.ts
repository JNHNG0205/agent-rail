"use client";

import { useEffect, useState } from "react";
import { publicClient } from "@/lib/viem";
import { jobContract } from "@/lib/contracts";
import { ZERO_ADDRESS, formatUsdc } from "@agentrail/shared";
import type { Log } from "viem";

export interface FormattedEvent {
  id: string;
  eventName: string;
  jobId?: string;
  txHash: `0x${string}`;
  formattedAmount?: string;
  details: string;
  timestamp: Date;
}

/// Listens for live JobContract events (JobCreated, DeliverableSubmitted, JobCompleted, JobFunded, etc.)
/// and formats USDC amounts using 6-decimal bigint rules. Member 3.
export function useLiveEvents() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [formattedEvents, setFormattedEvents] = useState<FormattedEvent[]>([]);

  useEffect(() => {
    if (!jobContract.address || jobContract.address === ZERO_ADDRESS) {
      return;
    }

    const unwatch = publicClient.watchContractEvent({
      address: jobContract.address,
      abi: jobContract.abi,
      onLogs: (newLogs: Log[]) => {
        setLogs((prev) => {
          const existingKeys = new Set(prev.map((e) => `${e.transactionHash}-${e.logIndex}`));
          const filtered = newLogs.filter((l) => !existingKeys.has(`${l.transactionHash}-${l.logIndex}`));
          return [...filtered, ...prev];
        });

        // Parse log details for EventFeed component
        const parsedList: FormattedEvent[] = newLogs.map((log: Log & { args?: Record<string, unknown>; eventName?: string }) => {
          const eventName = log.eventName ?? "ContractEvent";
          const args = log.args ?? {};
          const jobId = args.jobId !== undefined ? String(args.jobId) : undefined;
          
          let details = `Event: ${eventName}`;
          let formattedAmount: string | undefined;

          if (args.amount !== undefined && typeof args.amount === "bigint") {
            formattedAmount = `${formatUsdc(args.amount)} USDC`;
          } else if (args.refund !== undefined && typeof args.refund === "bigint") {
            formattedAmount = `${formatUsdc(args.refund)} USDC`;
          }

          if (eventName === "JobCreated") {
            details = `Job #${jobId} created with ${formattedAmount ?? "0 USDC"}`;
          } else if (eventName === "JobFunded") {
            details = `Job #${jobId} funded with ${formattedAmount ?? "0 USDC"}`;
          } else if (eventName === "DeliverableSubmitted" || eventName === "WorkSubmitted") {
            details = `Deliverable submitted for Job #${jobId}`;
          } else if (eventName === "JobCompleted") {
            details = `Job #${jobId} settled and completed (${formattedAmount ?? "0 USDC"})`;
          } else if (eventName === "JobCancelled") {
            details = `Job #${jobId} cancelled. Refunded ${formattedAmount ?? "0 USDC"}`;
          }

          return {
            id: `${log.transactionHash}-${log.logIndex}`,
            eventName,
            jobId,
            txHash: log.transactionHash as `0x${string}`,
            formattedAmount,
            details,
            timestamp: new Date(),
          };
        });

        setFormattedEvents((prev) => [...parsedList, ...prev]);
      },
      onError: (err: Error) => console.error("[useLiveEvents]", err),
    } as never);

    return () => unwatch();
  }, []);

  return { logs, events: formattedEvents };
}

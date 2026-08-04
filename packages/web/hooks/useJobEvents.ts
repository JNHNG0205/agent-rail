"use client";

import { useEffect, useState } from "react";
import { publicClient } from "@/lib/viem";
import { jobContract } from "@/lib/contracts";
import { ZERO_ADDRESS } from "@agentrail/shared";
import type { Log } from "viem";

/// Subscribes to live JobContract events via viem's watchContractEvent so the
/// UI updates in real time. Member 3.
export function useJobEvents() {
  const [events, setEvents] = useState<Log[]>([]);

  useEffect(() => {
    if (!jobContract.address || jobContract.address === ZERO_ADDRESS) {
      return;
    }
    const unwatch = publicClient.watchContractEvent({
      address: jobContract.address,
      abi: jobContract.abi,
      onLogs: (logs: Log[]) => {
        setEvents((prev) => {
          const existingKeys = new Set(prev.map((e) => `${e.transactionHash}-${e.logIndex}`));
          const newLogs = logs.filter((l) => !existingKeys.has(`${l.transactionHash}-${l.logIndex}`));
          return [...newLogs, ...prev];
        });
      },
      onError: (err: Error) => console.error("[useJobEvents]", err),
    } as never);
    return () => unwatch();
  }, []);

  return events;
}

"use client";

import { useEffect, useState } from "react";
import { publicClient } from "@/lib/viem";
import { jobContract } from "@/lib/contracts";
import type { Log } from "viem";

/// Subscribes to live JobContract events via viem's watchContractEvent so the
/// UI updates in real time. Member 3.
export function useJobEvents() {
  const [events, setEvents] = useState<Log[]>([]);

  useEffect(() => {
    const unwatch = publicClient.watchContractEvent({
      ...jobContract,
      onLogs: (logs) => setEvents((prev) => [...logs, ...prev]),
      onError: (err) => console.error("[useJobEvents]", err),
    });
    return () => unwatch();
  }, []);

  return events;
}

"use client";

import { useEffect, useState, useCallback } from "react";
import type { Agent } from "@agentrail/shared";
import { readReputation, readUsdcBalance } from "@/lib/contracts";

export interface EnrichedAgent extends Agent {
  liveReputation?: bigint;
  usdcBalance?: bigint;
}

/// Loads agents from /api/agents and enriches them with live on-chain reputation and USDC balance. Member 3.
export function useAgentData(address?: `0x${string}`) {
  const [agents, setAgents] = useState<EnrichedAgent[]>([]);
  const [agent, setAgent] = useState<EnrichedAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agents");
      if (!res.ok) {
        throw new Error(`Failed to fetch agents: ${res.statusText}`);
      }
      const data: Agent[] = await res.json();

      const enriched = await Promise.all(
        data.map(async (a) => {
          try {
            const [rep, bal] = await Promise.all([
              readReputation(a.address).catch(() => 0n),
              readUsdcBalance(a.address).catch(() => 0n),
            ]);
            return { ...a, liveReputation: rep, usdcBalance: bal };
          } catch {
            return a;
          }
        })
      );

      setAgents(enriched);

      if (address) {
        const found = enriched.find((a) => a.address.toLowerCase() === address.toLowerCase());
        setAgent(found ?? null);
      } else {
        setAgent(null);
      }
    } catch (err) {
      console.error("[useAgentData]", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return { agent, agents, loading, error, refetch: fetchAgents };
}

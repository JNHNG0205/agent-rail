"use client";

import { useCallback, useEffect, useState } from "react";
import { agentLabel } from "@agentrail/shared";
import type { Agent } from "@/lib/agentrail-data";
import { truncateHex } from "@/lib/agentrail-data";
import { readAgentStats, type AgentStats } from "@/lib/contracts";
import { useSession } from "@/lib/session";
import { errorMessage } from "@/lib/errors";

/// Every agent the system knows about, from the three sources that actually
/// have data. Member 4.
///
///   /api/agents          what the chain recorded — address, token id
///   /api/runtime/agents  what the runtime hosts — name, role, what it sells
///   the chain itself     reputation and USDC balance, read live
///
/// Merged rather than picked between, because neither is complete. A registered
/// identity the runtime does not host is an agent nobody is running; an agent
/// created moments ago is hosted but not yet indexed. Both are real states, and
/// showing them is more useful than hiding the difference.

interface IndexedAgent {
  address: `0x${string}`;
  tokenId: string | null;
  reputation: string;
  registeredAt: string | null;
}

interface RuntimeAgent {
  id: string;
  name: string;
  role: "client" | "provider";
  address: `0x${string}`;
  service: {
    summary: string;
    priceUsdc: string;
    requirements: string[];
    category?: string;
  } | null;
  createdBy: string | null;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function useRegistry() {
  const { owner } = useSession();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [indexed, hosted] = await Promise.all([
        fetchJson<IndexedAgent[]>("/api/agents"),
        fetchJson<RuntimeAgent[]>("/api/runtime/agents"),
      ]);

      if (!indexed && !hosted) {
        throw new Error("neither the indexer nor the agent runtime is reachable");
      }

      const byAddress = new Map<string, Agent>();

      for (const a of indexed ?? []) {
        byAddress.set(a.address.toLowerCase(), {
          address: a.address,
          label: agentLabel(a.address),
          name: agentLabel(a.address),
          role: "unknown",
          tokenId: a.tokenId ? Number(a.tokenId) : undefined,
          reputation: Number(a.reputation ?? 0),
        });
      }

      // The runtime knows the things the chain has nowhere to store: what an
      // agent is called, what it does, and what it charges.
      for (const h of hosted ?? []) {
        const key = h.address.toLowerCase();
        const existing = byAddress.get(key);
        byAddress.set(key, {
          id: h.id,
          address: h.address,
          label: h.name,
          name: h.name,
          role: h.role,
          tokenId: existing?.tokenId,
          reputation: existing?.reputation ?? 0,
          service: h.service,
          createdBy: h.createdBy,
        });
      }

      const merged = [...byAddress.values()].map((a) => ({
        ...a,
        label: a.label.startsWith("0x") ? truncateHex(a.address) : a.label,
      }));

      // Live, because reputation moves with every settlement and the indexer
      // lags by a few seconds — but in one request rather than two per agent.
      // The per-agent version issued sixteen calls for eight agents on every
      // load, from every open tab, against a shared and exhaustible key.
      const stats = await readAgentStats(merged.map((a) => a.address)).catch(
        () => new Map<string, AgentStats>(),
      );

      setAgents(
        merged.map((a) => {
          const live = stats.get(a.address.toLowerCase());
          return {
            ...a,
            reputation: live ? Number(live.reputation) : a.reputation,
            usdcBalance: live?.usdcBalance,
          };
        }),
      );
    } catch (err) {
      setError(errorMessage(err, "could not load agents"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Agents this person created. The full list stays available beside it —
  // ownership restricts acting, not seeing, and an agent finds a counterparty by
  // reading what everyone offers, so the marketplace has to show everyone.
  const mine = owner
    ? agents.filter((a) => a.createdBy?.toLowerCase() === owner.toLowerCase())
    : [];

  return { agents, mine, loading, error, refetch: load };
}

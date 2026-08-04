"use client";

import { useEffect, useState } from "react";
import type { Agent } from "@agentrail/shared";

/// Loads one agent's indexed profile from /api/agents. Member 3.
export function useAgentData(address: `0x${string}`) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/agents")
      .then((res) => res.json())
      .then((agents: Agent[]) => {
        if (!active) return;
        setAgent(agents.find((a) => a.address.toLowerCase() === address.toLowerCase()) ?? null);
      })
      .catch((err) => console.error("[useAgentData]", err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [address]);

  return { agent, loading };
}

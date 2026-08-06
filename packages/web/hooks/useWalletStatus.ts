"use client";

import { useCallback, useEffect, useState } from "react";
import { readReputation, readUsdcBalance } from "@/lib/contracts";

/// What a connected wallet actually is on this system. Member 4.
///
/// Connecting does not make you a party to anything. The agents hold their own
/// ERC-4337 accounts and sign their own transactions, which is what lets them
/// work while nobody is watching — so a connected wallet is an observer unless
/// its address happens to be a registered agent.
///
/// Saying that plainly is the point. A wallet button that connects and then
/// changes nothing invites the assumption that your funds are at stake, and the
/// honest answer — that they are not, and why — is a better one.

export interface WalletStatus {
  /// True when this address holds an identity token, i.e. it is itself an agent.
  isRegisteredAgent: boolean;
  /// Name from the runtime, when it hosts an agent at this address.
  agentName: string | null;
  usdcBalance: bigint | null;
  reputation: number | null;
  loading: boolean;
}

interface IndexedAgent {
  address: string;
  tokenId: string | null;
}

interface RuntimeAgent {
  address: string;
  name: string;
}

export function useWalletStatus(address: `0x${string}` | null): WalletStatus {
  const [status, setStatus] = useState<WalletStatus>({
    isRegisteredAgent: false,
    agentName: null,
    usdcBalance: null,
    reputation: null,
    loading: false,
  });

  const load = useCallback(async () => {
    if (!address) {
      setStatus({
        isRegisteredAgent: false,
        agentName: null,
        usdcBalance: null,
        reputation: null,
        loading: false,
      });
      return;
    }

    setStatus((s) => ({ ...s, loading: true }));
    const lower = address.toLowerCase();

    const [indexed, hosted, usdc, rep] = await Promise.all([
      fetch("/api/agents").then((r) => (r.ok ? (r.json() as Promise<IndexedAgent[]>) : [])).catch(() => []),
      fetch("/api/runtime/agents").then((r) => (r.ok ? (r.json() as Promise<RuntimeAgent[]>) : [])).catch(() => []),
      readUsdcBalance(address).catch(() => null),
      readReputation(address).catch(() => null),
    ]);

    setStatus({
      isRegisteredAgent: indexed.some((a) => a.address.toLowerCase() === lower),
      agentName: hosted.find((a) => a.address.toLowerCase() === lower)?.name ?? null,
      usdcBalance: usdc,
      reputation: rep !== null ? Number(rep) : null,
      loading: false,
    });
  }, [address]);

  useEffect(() => {
    void load();
  }, [load]);

  return status;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { createWalletClient, custom } from "viem";
import { useWallets } from "@privy-io/react-auth";
import { CHAIN_ID, MockUSDCAbi, addresses, agentModel } from "@agentrail/shared";
import { chain, publicClient } from "@/lib/viem";
import { useAuthedFetch, useSession } from "@/lib/session";

/// Paying for an agent. Member 4.
///
/// The person signs this from their own wallet, so it is a real payment they
/// authorise rather than something spent on their behalf. The consequence is that
/// this page cannot be believed about it: the runtime reads the transaction back
/// off the chain before it creates anything.
///
/// Waits for the receipt rather than returning on submission. The runtime cannot
/// verify a transaction it cannot see, and handing it a hash that is still in the
/// mempool means a creation that fails for a reason the person cannot act on.

export function useCreationFee() {
  const { address } = useSession();
  const authedFetch = useAuthedFetch();
  const { wallets } = useWallets();
  const [treasury, setTreasury] = useState<`0x${string}` | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [stage, setStage] = useState<"idle" | "gas" | "signing" | "confirming">("idle");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/runtime/treasury")
      .then((r) => r.json())
      .then((body: { address?: `0x${string}` }) => {
        if (!cancelled) setTreasury(body.address ?? null);
      })
      .catch(() => {
        if (!cancelled) setTreasury(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!address) {
      setBalance(null);
      return;
    }
    try {
      const held = (await publicClient.readContract({
        address: addresses.MockUSDC,
        abi: MockUSDCAbi,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;
      setBalance(held);
    } catch {
      setBalance(null);
    }
  }, [address]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  /// Returns the transaction hash, or throws with something worth reading.
  const pay = useCallback(
    async (modelId: string): Promise<`0x${string}`> => {
      const model = agentModel(modelId);
      if (!model) throw new Error("pick a model first");
      if (!treasury) throw new Error("no treasury is configured to receive the fee");
      if (!address) throw new Error("connect a wallet to pay from");

      const wallet = wallets.find(
        (w) => w.address.toLowerCase() === address.toLowerCase(),
      );
      if (!wallet) {
        throw new Error("that wallet is no longer connected — reconnect it and try again");
      }

      try {
        // A wallet created at sign-in has never held ETH and cannot sign without
        // it. Asking somebody to approve a payment that then fails for gas is a
        // worse experience than a moment's wait.
        setStage("gas");
        const gas = await authedFetch("/api/wallet/gas", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ to: address }),
        });
        const gasBody = (await gas.json()) as { error?: string };
        if (gasBody.error) throw new Error(gasBody.error);

        await wallet.switchChain(CHAIN_ID);

        setStage("signing");
        const provider = await wallet.getEthereumProvider();
        const client = createWalletClient({
          account: address,
          chain,
          transport: custom(provider),
        });
        const hash = await client.writeContract({
          address: addresses.MockUSDC,
          abi: MockUSDCAbi,
          functionName: "transfer",
          args: [treasury, model.priceUsdc],
        });

        setStage("confirming");
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("the payment failed on chain");

        void refreshBalance();
        return hash;
      } finally {
        setStage("idle");
      }
    },
    [address, authedFetch, refreshBalance, treasury, wallets],
  );

  return { pay, stage, treasury, balance, refreshBalance };
}

"use client";

import { useCallback, useState } from "react";
import { encodeFunctionData } from "viem";
import { useSendTransaction } from "@privy-io/react-auth";
import { MockUSDCAbi, addresses, parseUsdc, formatUsdc } from "@agentrail/shared";
import { useAuthedFetch, useSession } from "@/lib/session";

/// Send USDC from your own wallet. Member 4.
///
/// Used both to fund an agent and to move money out to any address. They are the
/// same operation — an ERC-20 transfer the person signs — and naming it after
/// only one of them hid that.
///
/// This is deliberately not the mirror of agent withdrawal. Taking money out of
/// an agent happens server-side, because the runtime holds that key, and the
/// destination must be a wallet Privy has verified: the server is moving
/// custodial funds, and a page that could name the destination could redirect
/// somebody's earnings. Here the funds are in a wallet only the person controls
/// and they sign it themselves, so any address is theirs to choose — the risk is
/// a typo, not an authorisation hole, and refusing would be a wallet that will
/// not let you spend your own money.
///
/// One wrinkle stands in the way. A wallet created at sign-in has never held
/// ETH, and a wallet with no ETH cannot sign anything, so the treasury covers
/// the gas for the first move. That is a testnet faucet, not a solved problem —
/// on a real network the person would hold ETH, or the app would sponsor it
/// through a paymaster.

export type SendStage = "idle" | "gas" | "signing" | "confirming" | "done";

export function useSendUsdc() {
  const { address } = useSession();
  const authedFetch = useAuthedFetch();
  const { sendTransaction } = useSendTransaction();
  const [stage, setStage] = useState<SendStage>("idle");
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (to: `0x${string}`, amountUsdc: string): Promise<`0x${string}` | null> => {
      setError(null);

      if (!address) {
        setError("connect a wallet to send from");
        return null;
      }

      let amount: bigint;
      try {
        // Integer minor units, never a float — the same parser the escrow uses,
        // so what is quoted here is what the chain receives.
        amount = parseUsdc(amountUsdc);
      } catch (err) {
        setError(err instanceof Error ? err.message : "that is not a USDC amount");
        return null;
      }
      if (amount <= 0n) {
        setError("enter an amount greater than zero");
        return null;
      }

      try {
        // Gas first. Asking someone to sign and watching it fail for want of a
        // fraction of a cent is a worse experience than a moment's wait.
        setStage("gas");
        const gas = await authedFetch("/api/wallet/gas", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ to: address }),
        });
        const gasBody = (await gas.json()) as { error?: string };
        if (gasBody.error) throw new Error(gasBody.error);

        setStage("signing");
        const { hash } = await sendTransaction({
          to: addresses.MockUSDC,
          data: encodeFunctionData({
            abi: MockUSDCAbi,
            functionName: "transfer",
            args: [to, amount],
          }),
        });

        setStage("confirming");
        return hash;
      } catch (err) {
        setError(err instanceof Error ? err.message : "the transfer did not go through");
        return null;
      } finally {
        setStage("idle");
      }
    },
    [address, authedFetch, sendTransaction],
  );

  return { send, stage, error, formatUsdc };
}

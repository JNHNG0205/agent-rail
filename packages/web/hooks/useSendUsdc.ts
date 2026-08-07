"use client";

import { useCallback, useState } from "react";
import { createWalletClient, custom } from "viem";
import { useWallets } from "@privy-io/react-auth";
import { CHAIN_ID, MockUSDCAbi, addresses, parseUsdc, formatUsdc } from "@agentrail/shared";
import { chain } from "@/lib/viem";
import { useAuthedFetch, useSession } from "@/lib/session";
import { errorMessage } from "@/lib/errors";

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
/// It signs through whichever wallet the session is using, found by address and
/// asked for its EIP-1193 provider. That is deliberately not Privy's
/// useSendTransaction, which drives the embedded wallet only: someone who signed
/// in with their own MetaMask got "no embedded or connected wallet found for
/// address" and could not send at all. One path serves both, because an embedded
/// wallet exposes the same provider interface an external one does.
///
/// The chain is switched first. An external wallet is wherever its owner last
/// left it, and a transfer signed on the wrong network either fails or, worse,
/// succeeds against a different contract at the same address.
///
/// One wrinkle remains. A wallet created at sign-in has never held ETH, and a
/// wallet with no ETH cannot sign anything, so the treasury covers the gas for
/// the first move. That is a testnet faucet, not a solved problem — on a real
/// network the person would hold ETH, or the app would sponsor it through a
/// paymaster.

export type SendStage = "idle" | "gas" | "signing" | "confirming" | "done";

export function useSendUsdc() {
  const { address } = useSession();
  const authedFetch = useAuthedFetch();
  const { wallets } = useWallets();
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
        setError(errorMessage(err, "that is not a USDC amount"));
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

        // Found by address rather than taking the first: someone may have
        // several wallets connected, and the one the session is showing is the
        // one whose balance they were just looking at.
        const wallet = wallets.find(
          (w) => w.address.toLowerCase() === address.toLowerCase(),
        );
        if (!wallet) {
          throw new Error(
            "that wallet is no longer connected — reconnect it and try again",
          );
        }

        // An external wallet is wherever its owner last left it.
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
          args: [to, amount],
        });

        setStage("confirming");
        return hash;
      } catch (err) {
        setError(errorMessage(err, "the transfer did not go through"));
        return null;
      } finally {
        setStage("idle");
      }
    },
    [address, authedFetch, wallets],
  );

  return { send, stage, error, formatUsdc };
}

"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, Loader2, Wallet } from "lucide-react";
import { parseUsdc } from "@agentrail/shared";
import { exactUsdcAmount, formatUsdc } from "@/lib/agentrail-data";
import { Button } from "@/ui/button";
import { useSendUsdc } from "@/hooks/useSendUsdc";
import { useSession } from "@/lib/session";
import { readUsdcBalance } from "@/lib/contracts";
import type { Agent } from "@/lib/agentrail-data";
import { Portal } from "@/components/agentrail/portal";

/// Send your own USDC to one of your agents. Member 4.
///
/// This replaces a window.prompt, which worked and told the person nothing: not
/// what they held, not what it would cost, not that the treasury was about to
/// pay their gas, and not which of several things had failed. An amount typed
/// into a browser dialog is also unvalidated until it reaches the chain.
///
/// The three states below are worth showing separately because they fail for
/// unrelated reasons — the gas top-up is the platform's doing, the signature is
/// the person's, and the confirmation is the chain's.

interface Props {
  open: boolean;
  agent: Agent | null;
  onClose: () => void;
  onDeposited: () => void;
}

export function DepositModal({ open, agent, onClose, onDeposited }: Props) {
  const { address } = useSession();
  const { send, stage, error } = useSendUsdc();
  const [amount, setAmount] = useState("1");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // What you actually hold, so the amount field is a decision rather than a
  // guess. Read when the dialog opens, not on every keystroke.
  useEffect(() => {
    if (!open || !address) return;
    let cancelled = false;
    void readUsdcBalance(address)
      .then((b) => {
        if (!cancelled) setBalance(b);
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, address]);

  if (!open || !agent) return null;

  // Validated as it is typed, with the same parser the escrow uses — so an
  // amount this dialog accepts is one the chain will accept.
  let parsed: bigint | null = null;
  let amountError: string | null = null;
  try {
    parsed = parseUsdc(amount.trim());
    if (parsed <= 0n) amountError = "Enter an amount greater than zero.";
    else if (balance !== null && parsed > balance) {
      amountError = `You hold ${formatUsdc(balance)} USDC.`;
    }
  } catch {
    amountError = "Use a number with at most 6 decimal places.";
  }

  const busy = stage !== "idle";

  async function submit() {
    if (!agent || amountError || busy) return;
    setSent(null);
    const hash = await send(agent.address, amount.trim());
    if (hash) {
      setSent(hash);
      onDeposited();
    }
  }

  const STAGE_LABEL: Record<string, string> = {
    gas: "Covering gas…",
    signing: "Waiting for your signature…",
    confirming: "Confirming…",
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deposit-title"
        className="w-full max-w-md sheet rounded-2xl p-5 shadow-2xl"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ArrowDownLeft className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id="deposit-title" className="text-base font-semibold text-foreground">
              Deposit to {agent.name}
            </h2>
            <p className="text-xs text-muted-foreground">
              From your wallet. You sign it — nobody can move your funds for you.
            </p>
          </div>
        </div>

        {sent ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-foreground">
              Sent. It appears in {agent.name}&apos;s balance once the transfer confirms.
            </p>
            <code className="block truncate rounded-lg bg-secondary/60 px-2.5 py-2 font-mono text-xs text-muted-foreground">
              {sent}
            </code>
            <Button className="w-full" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="deposit-amount"
                className="text-[11px] uppercase tracking-wide text-muted-foreground"
              >
                Amount (USDC)
              </label>
              <input
                id="deposit-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                autoFocus
                disabled={busy}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:border-ring disabled:opacity-60"
              />
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Wallet className="size-3" aria-hidden="true" />
                  {balance === null ? "—" : `${formatUsdc(balance)} USDC available`}
                </span>
                {balance !== null && balance > 0n && (
                  <button
                    type="button"
                    // The exact balance, not the rounded one — "Use all" that
                    // leaves fractions behind is not what it says.
                    onClick={() => setAmount(exactUsdcAmount(balance))}
                    className="text-primary hover:underline"
                  >
                    Use all
                  </button>
                )}
              </div>
            </div>

            {amountError && !busy && (
              <p className="text-xs text-destructive">{amountError}</p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}

            <p className="rounded-lg bg-secondary/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Your wallet needs a little ETH to send this, and it has none — the
              treasury covers it first. That is a testnet faucet, not something
              that would exist on a real network.
            </p>

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => void submit()}
                disabled={busy || amountError !== null}
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> {STAGE_LABEL[stage] ?? "Working…"}
                  </>
                ) : (
                  "Deposit"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
    </Portal>
  );
}

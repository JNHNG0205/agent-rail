"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Loader2, Wallet } from "lucide-react";
import { formatUsdc as exactUsdc, parseUsdc } from "@agentrail/shared";
import { formatUsdc, truncateHex } from "@/lib/agentrail-data";
import { Button } from "@/ui/button";
import { useAuthedFetch } from "@/lib/session";
import type { Agent } from "@/lib/agentrail-data";
import { Portal } from "@/components/agentrail/portal";

/// Take an agent's earnings out to one of your own wallets. Member 4.
///
/// The destination is chosen, not assumed. Withdrawal used to send to
/// Privy's first verified wallet — the embedded one created at sign-in — so
/// somebody who had linked their own external wallet could not reach it, even
/// though the server would have accepted it. The list here is the same list the
/// server checks against, fetched from the identity token, so anything offered
/// will be accepted and nothing else can be.
///
/// A transfer cannot be undone, which is why there is no free-text address
/// field. Typing one would move the decision about where money goes from
/// something Privy has verified to something a page can be tricked into
/// suggesting.

interface LinkedWallet {
  address: `0x${string}`;
}

interface Props {
  open: boolean;
  agent: Agent | null;
  onClose: () => void;
  onWithdrawn: () => void;
}

export function WithdrawModal({ open, agent, onClose, onWithdrawn }: Props) {
  const authedFetch = useAuthedFetch();
  const [wallets, setWallets] = useState<LinkedWallet[] | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [to, setTo] = useState<`0x${string}` | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open || !agent) return;
    setError(null);
    setSent(null);
    // The whole balance is the common case; anything less is a deliberate act.
    setAmount(agent.usdcBalance !== undefined ? exactUsdc(agent.usdcBalance) : "");
    let cancelled = false;
    void authedFetch("/api/wallet/linked")
      .then((r) => r.json())
      .then((body: { wallets?: LinkedWallet[]; reason?: string }) => {
        if (cancelled) return;
        setWallets(body.wallets ?? []);
        setReason(body.reason ?? null);
        setTo(body.wallets?.[0]?.address ?? null);
      })
      .catch(() => {
        if (!cancelled) setWallets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, agent, authedFetch]);

  if (!open || !agent) return null;

  const balance = agent.usdcBalance ?? 0n;
  let amountError: string | null = null;
  try {
    const parsed = parseUsdc(amount.trim());
    if (parsed <= 0n) amountError = "Enter an amount greater than zero.";
    else if (parsed > balance) amountError = `${agent.name} holds ${formatUsdc(balance)} USDC.`;
  } catch {
    amountError = "Use a number with at most 6 decimal places.";
  }

  async function submit() {
    if (!agent || !to || amountError || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/runtime/agents/${agent.id}/withdraw`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // The exact amount, never the display format — the rounded one would
        // leave fractions behind and carries a unit the parser rejects.
        body: JSON.stringify({ to, amountUsdc: amount.trim() }),
      });
      const body = (await res.json()) as { error?: string; txHash?: string };
      if (body.error) throw new Error(body.error);
      setSent(body.txHash ?? "sent");
      onWithdrawn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "the withdrawal did not go through");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-title"
        className="w-full max-w-md sheet rounded-2xl p-5 shadow-2xl"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id="withdraw-title" className="text-base font-semibold text-foreground">
              Withdraw from {agent.name}
            </h2>
            <p className="text-xs text-muted-foreground">
              Holds {formatUsdc(balance)} USDC. The agent pays its own gas.
            </p>
          </div>
        </div>

        {sent ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-foreground">Sent.</p>
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
                htmlFor="withdraw-amount"
                className="text-[11px] uppercase tracking-wide text-muted-foreground"
              >
                Amount (USDC)
              </label>
              <input
                id="withdraw-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                disabled={busy}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:border-ring disabled:opacity-60"
              />
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Send to
              </p>
              {wallets === null ? (
                <p className="mt-1 text-xs text-muted-foreground">Checking your wallets…</p>
              ) : wallets.length === 0 ? (
                <p className="mt-1 text-xs text-destructive">
                  {reason ?? "No wallet is linked to your account."} Link one in Privy first —
                  money can only be sent to an address Privy has verified as yours.
                </p>
              ) : (
                <div className="mt-1 space-y-1.5">
                  {wallets.map((w) => (
                    <label
                      key={w.address}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm transition-colors hover:bg-secondary"
                    >
                      <input
                        type="radio"
                        name="destination"
                        checked={to === w.address}
                        onChange={() => setTo(w.address)}
                        disabled={busy}
                      />
                      <Wallet className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      <code className="font-mono text-xs">{truncateHex(w.address, 10, 8)}</code>
                    </label>
                  ))}
                  {wallets.length === 1 && (
                    // The answer to "can I send this to my own MetaMask?" — yes,
                    // once Privy can vouch that it is yours.
                    <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                      To withdraw to a different wallet — your own MetaMask, for instance —
                      link it to your account in Privy and it appears here.
                    </p>
                  )}
                </div>
              )}
            </div>

            {amountError && !busy && <p className="text-xs text-destructive">{amountError}</p>}
            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => void submit()}
                disabled={busy || !to || amountError !== null}
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Sending…
                  </>
                ) : (
                  "Withdraw"
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

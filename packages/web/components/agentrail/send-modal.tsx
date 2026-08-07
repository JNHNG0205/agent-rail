"use client";

import { useEffect, useState } from "react";
import { getAddress, isAddress } from "viem";
import { Loader2, Send, TriangleAlert } from "lucide-react";
import { formatUsdc as exactUsdc, parseUsdc } from "@agentrail/shared";
import { formatUsdc } from "@/lib/agentrail-data";
import { Button } from "@/ui/button";
import { useSendUsdc } from "@/hooks/useSendUsdc";
import { useSession } from "@/lib/session";
import { readUsdcBalance } from "@/lib/contracts";

/// Send USDC from your wallet to any address. Member 4.
///
/// Any address, deliberately. Withdrawing from an agent is restricted to wallets
/// Privy has verified, because there the server moves funds it holds custody of
/// and a page that could name the destination could redirect somebody's
/// earnings. This is the opposite case: the money is in a wallet only you
/// control and you sign the transaction, so the app has no business deciding
/// where it may go. A wallet that will not let you spend your own money is not
/// a safety feature.
///
/// What is left is a typo, and typos here are permanent. So the address is
/// validated and checksummed, the amount is checked against the balance, and the
/// final press states plainly what is about to happen and that it cannot be
/// undone.

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SendModal({ open, onClose }: Props) {
  const { address } = useSession();
  const { send, stage, error } = useSendUsdc();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open || !address) return;
    setTo("");
    setAmount("");
    setSent(null);
    setConfirming(false);
    let cancelled = false;
    void readUsdcBalance(address)
      .then((b) => !cancelled && setBalance(b))
      .catch(() => !cancelled && setBalance(null));
    return () => {
      cancelled = true;
    };
  }, [open, address]);

  if (!open) return null;

  const trimmed = to.trim();
  // isAddress accepts a mixed-case address only when its checksum is valid, so
  // a mistyped character in an address copied from an explorer is caught here
  // rather than by the chain accepting a transfer to nobody.
  const addressValid = isAddress(trimmed);
  const sendingToSelf = addressValid && address && getAddress(trimmed) === getAddress(address);

  let amountError: string | null = null;
  try {
    const parsed = parseUsdc(amount.trim());
    if (parsed <= 0n) amountError = "Enter an amount greater than zero.";
    else if (balance !== null && parsed > balance) {
      amountError = `You hold ${formatUsdc(balance)} USDC.`;
    }
  } catch {
    amountError = amount.trim() ? "Use a number with at most 6 decimal places." : null;
  }

  const busy = stage !== "idle";
  const ready = addressValid && !sendingToSelf && !amountError && amount.trim().length > 0;

  async function submit() {
    if (!ready || busy) return;
    const hash = await send(getAddress(trimmed), amount.trim());
    if (hash) setSent(hash);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-title"
        className="w-full max-w-md sheet rounded-2xl p-5 shadow-2xl"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Send className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id="send-title" className="text-base font-semibold text-foreground">
              Send USDC
            </h2>
            <p className="text-xs text-muted-foreground">
              From your wallet, to any address. You sign it.
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
        ) : confirming ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                <TriangleAlert className="size-3.5" aria-hidden="true" />
                This cannot be undone
              </p>
              <p className="mt-2 text-sm text-foreground">
                Send <strong>{amount.trim()} USDC</strong> to
              </p>
              <code className="mt-1 block break-all font-mono text-xs text-foreground">
                {addressValid ? getAddress(trimmed) : trimmed}
              </code>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Check the address against your own record. A transfer to a wrong
                address cannot be recovered by anyone.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                Back
              </Button>
              <Button className="flex-1" onClick={() => void submit()} disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Sending…
                  </>
                ) : (
                  "Send it"
                )}
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="send-to"
                className="text-[11px] uppercase tracking-wide text-muted-foreground"
              >
                To address
              </label>
              <input
                id="send-to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="0x…"
                autoFocus
                spellCheck={false}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:border-ring"
              />
              {trimmed.length > 0 && !addressValid && (
                <p className="mt-1 text-xs text-destructive">
                  Not a valid address. Check for a missing or altered character.
                </p>
              )}
              {sendingToSelf && (
                <p className="mt-1 text-xs text-destructive">
                  That is this wallet — sending to yourself only costs gas.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="send-amount"
                className="text-[11px] uppercase tracking-wide text-muted-foreground"
              >
                Amount (USDC)
              </label>
              <input
                id="send-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:border-ring"
              />
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {balance === null ? "—" : `${formatUsdc(balance)} USDC available`}
                </span>
                {balance !== null && balance > 0n && (
                  <button
                    type="button"
                    // The exact balance, never the rounded display value.
                    onClick={() => setAmount(exactUsdc(balance))}
                    className="text-primary hover:underline"
                  >
                    Use all
                  </button>
                )}
              </div>
              {amountError && <p className="mt-1 text-xs text-destructive">{amountError}</p>}
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={() => setConfirming(true)} disabled={!ready}>
                Review
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

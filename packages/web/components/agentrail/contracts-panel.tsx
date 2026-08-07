"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { CopyButton } from "@/components/agentrail/copy-button";
import { useAuthedFetch } from "@/lib/session";
import { truncateHex } from "@/lib/agentrail-data";

/// What the contracts are actually pointing at. Superadmin only. Member 4.
///
/// The one thing an owner has that nobody else does is the power to change this
/// wiring — `setEvaluatorModule`, `setIdentityRegistry`, `setReputationRegistry`
/// — so the one thing worth showing an owner is whether it still says what they
/// think it says.
///
/// Every row is read from the chain and compared to the address `deploy.ts`
/// recorded. Those normally agree, and when they do not it matters more than
/// almost anything else on screen: re-pointing the evaluator module changes who
/// is allowed to release escrow on every future job.
///
/// Read-only. Changing any of this needs the deployer's key, and that key does
/// not belong in a browser.

interface Wiring {
  name: string;
  onChain: string | null;
  expected: string;
}

interface Config {
  chainId: number;
  jobContract: string;
  owner: string | null;
  wiring: Wiring[];
}

export function ContractsPanel() {
  const authedFetch = useAuthedFetch();
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void authedFetch("/api/admin/contracts")
      .then((r) => r.json())
      .then((body: Config & { error?: string }) => {
        if (cancelled) return;
        if (body.error) setError(body.error);
        else setConfig(body);
      })
      .catch(() => {
        if (!cancelled) setError("could not read the contract wiring");
      });
    return () => {
      cancelled = true;
    };
  }, [authedFetch]);

  if (error) {
    return <p className="sheet px-4 py-3 text-sm text-destructive">{error}</p>;
  }
  if (!config) {
    return <p className="text-sm text-muted-foreground">Reading the contracts…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="sheet rounded-2xl p-5">
        <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
          JobContract · chain {config.chainId}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <code className="truncate font-mono text-sm">{config.jobContract}</code>
          <CopyButton value={config.jobContract} label="Copy JobContract address" />
        </div>
        <p className="mt-4 text-[11px] tracking-wide text-muted-foreground uppercase">
          Owner
        </p>
        <div className="mt-1 flex items-center gap-2">
          <code className="truncate font-mono text-sm">{config.owner ?? "unreadable"}</code>
          {config.owner && <CopyButton value={config.owner} label="Copy owner address" />}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          This account can re-point the three registries below. It is deliberately
          not any of the agents: one that held it could rewrite the rules its own
          jobs are judged under.
        </p>
      </div>

      <div className="sheet overflow-hidden rounded-2xl">
        <div className="border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">Wiring</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Read from the chain, compared with what the deployment recorded. The
            chain is what every future job obeys.
          </p>
        </div>
        <ul className="divide-y divide-border">
          {config.wiring.map((row) => {
            const matches =
              row.onChain !== null &&
              row.onChain.toLowerCase() === row.expected.toLowerCase();
            return (
              <li key={row.name} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{row.name}</p>
                  <code className="font-mono text-xs text-muted-foreground">
                    {row.onChain ? truncateHex(row.onChain as `0x${string}`, 10, 8) : "unreadable"}
                  </code>
                </div>
                {matches ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-[var(--state-settled)]">
                    <Check className="size-3.5" aria-hidden="true" />
                    as deployed
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-[var(--state-refunded)]">
                    <AlertTriangle className="size-3.5" aria-hidden="true" />
                    differs from the deployment
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

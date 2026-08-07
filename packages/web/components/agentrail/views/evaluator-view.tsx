"use client";

import { CheckCircle2, ShieldCheck, XCircle, Clock } from "lucide-react";
import { agentLabel } from "@agentrail/shared";
import { formatUsdc, truncateHex } from "@/lib/agentrail-data";
import { useJobs } from "@/hooks/useJobs";
import { CopyButton } from "@/components/agentrail/copy-button";
import { cn } from "@/lib/utils";

/// What the evaluator actually decided, per job. Member 4.
///
/// This used to be a signature-verification toy: it hashed some text with a
/// stand-in function and compared a pasted signature against a constant, so it
/// always agreed with itself and had no connection to any job. It demonstrated
/// the idea and nothing about the system.
///
/// Now it reports real outcomes. Each row is a job the evaluator ruled on, and
/// the ruling is why the money moved — approved releases escrow to the provider,
/// rejected refunds the client. None of it is computed here: the decision was
/// made off-chain, signed, verified on chain by EvaluatorModule, and recorded by
/// the indexer.

type Verdict = "approved" | "rejected" | "timeout" | "pending";

function verdictOf(state: number, outcome: string | null): Verdict {
  if (state !== 3) return "pending";
  if (outcome === "completed") return "approved";
  if (outcome === "timeoutClaimed") return "timeout";
  return "rejected";
}

const VERDICT_META: Record<Verdict, { label: string; tone: string; icon: React.ReactNode }> = {
  approved: {
    label: "Approved — provider paid",
    tone: "bg-success/15 text-success",
    icon: <CheckCircle2 className="size-4" aria-hidden="true" />,
  },
  rejected: {
    label: "Rejected — client refunded",
    tone: "bg-destructive/15 text-destructive",
    icon: <XCircle className="size-4" aria-hidden="true" />,
  },
  timeout: {
    // The provider claimed after the deadline, so the evaluator never ruled.
    label: "Timed out — provider claimed",
    tone: "bg-warning/15 text-warning",
    icon: <Clock className="size-4" aria-hidden="true" />,
  },
  pending: {
    label: "Awaiting evaluation",
    tone: "bg-muted text-muted-foreground",
    icon: <Clock className="size-4" aria-hidden="true" />,
  },
};

export function EvaluatorView() {
  const { jobs, loading } = useJobs();

  // Submitted or Terminal: everything the evaluator has ruled on, plus what is
  // waiting on it.
  const ruled = jobs.filter((j) => j.state === 3 || j.state === 2);
  const approved = jobs.filter((j) => j.state === 3 && j.outcome === "completed").length;
  const rejected = jobs.filter((j) => j.state === 3 && j.outcome === "cancelled").length;
  const waiting = jobs.filter((j) => j.state === 2).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Why each job paid out</h2>
        <p className="text-sm text-muted-foreground">
          A third agent grades every delivery — never the one that ordered the work,
          and never the one that made it. It signs its decision, and the contract
          checks that signature before releasing a penny.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Approved", value: approved, tone: "text-success" },
          { label: "Rejected", value: rejected, tone: "text-destructive" },
          { label: "Awaiting decision", value: waiting, tone: "" },
        ].map((m) => (
          <div key={m.label} className="sheet rounded-2xl p-5">
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{m.label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", m.tone)}>{m.value}</p>
          </div>
        ))}
      </div>

      {loading && ruled.length === 0 && (
        <p className="text-sm text-muted-foreground">Loading decisions…</p>
      )}

      {!loading && ruled.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium">Nothing evaluated yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Commission a job from the Assistant tab; its verdict will appear here.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {ruled.map((job) => {
          const verdict = verdictOf(job.state, job.outcome ?? null);
          const meta = VERDICT_META[verdict];
          return (
            <li key={String(job.id)} className="sheet rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-primary">
                    <ShieldCheck className="size-4" aria-hidden="true" />
                  </span>
                  <div className="leading-tight">
                    <p className="text-sm font-medium">Job #{String(job.id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {agentLabel(job.provider)} · {formatUsdc(BigInt(job.amount))} USDC
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    meta.tone,
                  )}
                >
                  {meta.icon}
                  {meta.label}
                </span>
              </div>

              {job.deliverableHash && (
                <div className="mt-4 flex items-start gap-2 border-t border-border pt-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                      Deliverable hash — what the evaluator graded
                    </p>
                    <code className="mt-1 block truncate font-mono text-sm">
                      {truncateHex(job.deliverableHash, 12, 10)}
                    </code>
                  </div>
                  <CopyButton value={job.deliverableHash} label="Copy deliverable hash" />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

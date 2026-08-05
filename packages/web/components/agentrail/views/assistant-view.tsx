"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, Store, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/ui/button";
import { useAssistant } from "@/hooks/useAssistant";
import { useSession } from "@/lib/session";
import { useJobResult, type JobStage } from "@/hooks/useJobResult";
import { cn } from "@/lib/utils";

/// Talk to your agent; it hires another; the result comes back. Member 4.
///
/// The whole product in one view — the other tabs explain what happened, this is
/// where it happens.

const STAGES: { id: JobStage; label: string }[] = [
  { id: "Open", label: "Job opened" },
  { id: "Funded", label: "Escrow funded" },
  { id: "Submitted", label: "Work delivered" },
  { id: "Terminal", label: "Evaluated" },
];

function Progress({ stage, outcome }: { stage: JobStage | null; outcome: string | null }) {
  const reached = stage ? STAGES.findIndex((s) => s.id === stage) : -1;

  return (
    <ol className="flex flex-col gap-2">
      {STAGES.map((s, i) => {
        const done = i <= reached;
        const current = i === reached && stage !== "Terminal";
        return (
          <li key={s.id} className="flex items-center gap-2.5 text-sm">
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[10px]",
                done ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
              )}
            >
              {current ? <Loader2 className="size-3 animate-spin" /> : done ? "✓" : i + 1}
            </span>
            <span className={done ? "text-foreground" : "text-muted-foreground"}>
              {s.id === "Terminal" && outcome
                ? outcome === "completed"
                  ? "Approved — provider paid"
                  : "Rejected — you were refunded"
                : s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function AssistantView() {
  const { client, providers, messages, brief, thinking, hiring, job, error, send, hire, reset, needsSignIn } =
    useAssistant();
  const { signIn } = useSession();
  const result = useJobResult(job?.jobId ?? null);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft;
    setDraft("");
    void send(text);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="flex min-h-[32rem] flex-col rounded-2xl border border-border bg-card">
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-primary">
              <Bot className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">{client?.name ?? "Your Assistant"}</p>
              <p className="text-xs text-muted-foreground">
                {client
                  ? "hires other agents on your behalf"
                  : needsSignIn
                    ? "sign in and I'm yours"
                    : "starting up…"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            New request
          </Button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <p
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground",
                )}
              >
                {m.content}
              </p>
            </div>
          ))}
          {thinking && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> thinking…
            </p>
          )}
          <div ref={endRef} />
        </div>

        {brief && (
          <div className="border-t border-border bg-secondary/40 px-5 py-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Ready to commission
            </p>
            <p className="mt-1.5 text-sm">
              <span className="font-medium">{brief.title}</span> — {brief.subtitle}
            </p>
            <p className="text-xs text-muted-foreground">
              {brief.callToAction} · {brief.palette}
            </p>
            <Button className="mt-3" onClick={() => void hire()} disabled={hiring || providers.length === 0}>
              {hiring ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Commissioning…
                </>
              ) : providers.length === 0 ? (
                "No provider available"
              ) : (
                "Hire an agent"
              )}
            </Button>
          </div>
        )}

        {needsSignIn && (
          <div className="flex items-center justify-between gap-3 border-t border-border bg-secondary/30 px-5 py-4">
            <p className="text-xs text-muted-foreground">
              Sign in to get your own assistant. It holds its own account and pays
              its own gas, so you need no wallet and nothing of yours is spent.
            </p>
            <Button size="sm" onClick={signIn}>
              Sign in
            </Button>
          </div>
        )}

        <form onSubmit={submit} className="flex gap-2 border-t border-border px-5 py-4">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="I need a poster for our demo day…"
            disabled={!client || thinking}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
          />
          <Button type="submit" size="icon" disabled={!client || thinking || draft.trim().length === 0}>
            <Send className="size-4" />
          </Button>
        </form>
      </section>

      <aside className="flex flex-col gap-4">
        {error && (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {job && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Job {job.jobId}
            </p>
            <p className="mt-1 mb-4 text-sm">
              {job.providerName} · {job.amountUsdc} USDC in escrow
            </p>
            <Progress stage={result.stage} outcome={result.outcome} />

            {result.deliverableUrl && (
              <div className="mt-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {result.outcome === "completed" ? (
                    <CheckCircle2 className="size-3.5 text-success" />
                  ) : result.outcome ? (
                    <XCircle className="size-3.5 text-destructive" />
                  ) : null}
                  Delivered — hash verified against the chain
                </p>
                {/* Sandboxed: the SVG is untrusted output from another agent, and
                    the route serves it with a locked-down CSP. */}
                <iframe
                  src={result.deliverableUrl}
                  title={`Deliverable for job ${job.jobId}`}
                  sandbox=""
                  className="aspect-[3/4] w-full rounded-xl border border-border bg-white"
                />
              </div>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <Store className="size-3.5" /> Available agents
          </p>
          {providers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None yet — create a provider agent in the Registry tab.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {providers.map((p) => (
                <li key={p.id} className="text-sm">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.service?.priceUsdc} USDC · {p.service?.summary}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {providers.length > 1 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Your assistant compares them and hires the cheapest.
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}

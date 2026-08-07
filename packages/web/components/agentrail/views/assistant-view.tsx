"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Send,
  Store,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/ui/button";
import { useAssistant, type HiredJob } from "@/hooks/useAssistant";
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


/// One commissioned job, watching itself.
///
/// A component per job rather than one panel: useJobResult polls for a specific
/// id, so several jobs can only progress independently if each card owns its
/// own hook. That is also the honest picture — the agents genuinely do work at
/// the same time.
function JobCard({
  job,
  onDismiss,
  defaultOpen = false,
}: {
  job: HiredJob;
  onDismiss: () => void;
  /// Whether the preview starts open. True for the newest commission only:
  /// four full-size previews stacked is a column taller than the screen, and
  /// the older ones are results somebody has already looked at.
  defaultOpen?: boolean;
}) {
  const result = useJobResult(job.jobId);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(defaultOpen);

  /// Copying beats downloading for a document someone is about to paste. The
  /// bytes come from the same hash-checked route the preview uses, so what is
  /// copied is what the chain committed to.
  async function copyDeliverable(url: string) {
    try {
      const res = await fetch(url);
      await navigator.clipboard.writeText(await res.text());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the download link still works.
    }
  }


  return (
          <section className="sheet rounded-2xl p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Job {job.jobId}
                </p>
                <p className="mt-1 text-sm">
                  {job.providerName} · {job.amountUsdc} USDC in escrow
                </p>
              </div>
              {/* Offered only once it has finished. Hiding a job that is still running
                  is exactly how the single-card version lost track of work. */}
              {result.stage === "Terminal" && (
                <button
                  type="button"
                  onClick={onDismiss}
                  aria-label={`Dismiss job ${job.jobId}`}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="mb-4" />
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

                {/* The work is the thing that was paid for, so it has to be
                    takeable. Preview alone leaves it trapped behind a session. */}
                <div className="mb-2 flex items-center gap-2">
                  <a
                    href={`${result.deliverableUrl}?download=1`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    <Download className="size-3.5" aria-hidden="true" /> Download
                  </a>
                  <a
                    href={result.deliverableUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    <ExternalLink className="size-3.5" aria-hidden="true" /> Open
                  </a>
                  {job.kind !== "svg" && (
                    <button
                      type="button"
                      onClick={() => void copyDeliverable(result.deliverableUrl!)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      {copied ? (
                        <Check className="size-3.5 text-success" aria-hidden="true" />
                      ) : (
                        <Copy className="size-3.5" aria-hidden="true" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  {showPreview ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  {showPreview ? "Hide preview" : "Show preview"}
                </button>

                {/* Sandboxed: the deliverable is untrusted output from another
                    agent, and the route serves it with a locked-down CSP. An
                    iframe suits every kind — the route sets the content type, so
                    the browser renders a drawing as one and a document as text. */}
                {showPreview && (
                <iframe
                  src={result.deliverableUrl}
                  title={`Deliverable for job ${job.jobId}`}
                  sandbox=""
                  // The page declares color-scheme: dark, and an iframe
                  // inherits it — so a plain-text deliverable was rendered with
                  // dark-mode defaults, white on the white background set here,
                  // and could only be read by selecting it. The document inside
                  // is the provider's own bytes and is not ours to restyle, so
                  // the frame declares light instead.
                  style={{ colorScheme: "light" }}
                  className={cn(
                    "w-full rounded-xl border border-border bg-white",
                    // A poster is portrait; a document is not, and forcing one
                    // into that shape wastes most of the frame on white space.
                    // A page is laid out for a screen, so it gets the most room
                    // — a landing page in a document-sized frame is all scrollbar.
                    job.kind === "svg"
                      ? "aspect-[3/4]"
                      : job.kind === "html"
                        ? "h-[32rem]"
                        : "h-80",
                  )}
                />
                )}
              </div>
            )}
          </section>
  );
}

export function AssistantView() {
  const { client, providers, messages, brief, thinking, hiring, jobs, dismissJob, error, send, hire, reset, needsSignIn } =
    useAssistant();
  const { signIn } = useSession();
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
    // Fixed to the viewport on a wide screen, with each column scrolling
    // itself. The page used to grow with every commission — four job cards, each
    // with a full-size preview, made a column several screens tall while the
    // conversation beside it sat in white space. A chat that scrolls the whole
    // document is also the wrong shape: the composer should stay put.
    <div className="grid gap-6 lg:h-[calc(100vh-10rem)] lg:grid-cols-[1fr_20rem]">
      <section className="flex min-h-[32rem] flex-col sheet rounded-2xl lg:min-h-0">
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
          {/* A full-height panel holding one greeting read as a page that had
              failed to load. Before a conversation exists, the space says what
              this agent can be asked for instead of standing empty — and the
              examples are generic on purpose, because what is actually on offer
              depends on who has published a service. */}
          {messages.length <= 1 && !thinking && (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
                <Bot className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">
                Describe what you need
              </h3>
              <p className="mt-1.5 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
                Your agent reads the directory, picks a counterparty whose service
                covers it, and escrows the fee before any work starts. It will say so
                plainly if nobody sells what you are asking for.
              </p>
              <ul className="mt-5 flex flex-wrap justify-center gap-2">
                {[
                  "a launch poster for a coffee shop",
                  "a release note for version 2.1",
                  "a landing page in warm colours",
                ].map((example) => (
                  <li
                    key={example}
                    className="rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground"
                  >
                    {example}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {messages.length > 1 && messages.map((m, i) => (
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
              <span className="font-medium">{brief.request}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Graded on: {brief.requirements.join(" · ")}
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
            placeholder="Tell your agent what you need…"
            disabled={!client || thinking}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
          />
          <Button type="submit" size="icon" disabled={!client || thinking || draft.trim().length === 0}>
            <Send className="size-4" />
          </Button>
        </form>
      </section>

      <aside className="flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
        {error && (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {jobs.map((job, i) => (
          <JobCard
            key={job.jobId}
            job={job}
            defaultOpen={i === 0}
            onDismiss={() => dismissJob(job.jobId)}
          />
        ))}

        <section className="sheet rounded-2xl p-5">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <Store className="size-3.5" /> Available agents
          </p>
          {providers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None yet — create one on the Marketplace tab, then I will have somebody to hire.
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

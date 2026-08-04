"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/ui/button";

/// Create a provider agent — one that sells a service to other agents. Member 4.
///
/// The runtime generates its key, derives an ERC-4337 smart account, funds it
/// and registers its identity. The user never handles a key and never pastes an
/// address: an identity minted to an address nobody holds the key for is an
/// agent that can never act.
///
/// Purpose is plain language, and the terms the agent will be graded against are
/// proposed from it and shown before anything is created. That step is not
/// decoration — a registration is soulbound and cannot be undone, so the person
/// should see what their agent is promising while they can still change it.

interface ServiceOffer {
  summary: string;
  priceUsdc: string;
  requirements: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

type Stage = "describe" | "confirm" | "working" | "done";

export function CreateProviderModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [offer, setOffer] = useState<ServiceOffer | null>(null);
  const [stage, setStage] = useState<Stage>("describe");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; address: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  function reset() {
    setName("");
    setPurpose("");
    setOffer(null);
    setStage("describe");
    setError(null);
    setCreated(null);
  }

  function dismiss() {
    reset();
    onClose();
  }

  async function propose() {
    setError(null);
    setStage("working");
    try {
      const res = await fetch("/api/runtime/agents/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, purpose }),
      });
      const body = (await res.json()) as ServiceOffer | { error: string };
      if ("error" in body) throw new Error(body.error);
      setOffer(body);
      setStage("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not propose a service");
      setStage("describe");
    }
  }

  async function create() {
    if (!offer) return;
    setError(null);
    setStage("working");
    try {
      const res = await fetch("/api/runtime/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, role: "provider", service: offer }),
      });
      const body = (await res.json()) as { name: string; address: string } | { error: string };
      if ("error" in body) throw new Error(body.error);
      setCreated(body);
      setStage("done");
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not create the agent");
      setStage("confirm");
    }
  }

  const busy = stage === "working";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-medium">Create a provider agent</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          It sells a service to other agents, and is paid from escrow when the
          evaluator approves its work.
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {stage === "done" && created ? (
          <div className="mt-5">
            <p className="text-sm">
              <span className="font-medium">{created.name}</span> is live — identity registered
              on chain, and watching for work.
            </p>
            <p className="mt-1.5 font-mono text-xs break-all text-muted-foreground">
              {created.address}
            </p>
            <Button className="mt-5 w-full" onClick={dismiss}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <label className="mt-5 block text-sm">
              <span className="mb-1.5 block font-medium">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Poster Studio"
                disabled={busy || stage === "confirm"}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring disabled:opacity-60"
              />
            </label>

            <label className="mt-4 block text-sm">
              <span className="mb-1.5 block font-medium">What does it do?</span>
              <textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={3}
                placeholder="I design event posters as a single SVG"
                disabled={busy || stage === "confirm"}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring disabled:opacity-60"
              />
            </label>

            {stage === "confirm" && offer && (
              <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Proposed service
                </p>
                <p className="mt-1.5 text-sm">{offer.summary}</p>

                <label className="mt-3 block">
                  <span className="mb-1 block text-xs text-muted-foreground">Price (USDC)</span>
                  <input
                    value={offer.priceUsdc}
                    onChange={(e) => setOffer({ ...offer, priceUsdc: e.target.value })}
                    inputMode="numeric"
                    className="w-28 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus-visible:border-ring"
                  />
                </label>

                <p className="mt-3 text-xs text-muted-foreground">
                  Every delivery is graded against these, and payment depends on them:
                </p>
                <ul className="mt-1.5 list-disc pl-5 text-sm">
                  {offer.requirements.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <Button variant="ghost" onClick={dismiss} disabled={busy}>
                Cancel
              </Button>
              {stage === "confirm" ? (
                <>
                  <Button variant="ghost" onClick={() => setStage("describe")} disabled={busy}>
                    Back
                  </Button>
                  <Button className="flex-1" onClick={() => void create()} disabled={busy}>
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    Create agent
                  </Button>
                </>
              ) : (
                <Button
                  className="flex-1"
                  onClick={() => void propose()}
                  disabled={busy || name.trim().length === 0 || purpose.trim().length < 8}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  Propose its service
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

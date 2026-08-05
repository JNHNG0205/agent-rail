"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthedFetch, useSession } from "@/lib/session";

/// Talking to your agent, and getting it to commission work. Member 4.
///
/// The conversation lives here rather than on the server: the runtime is
/// stateless by design, so the whole history goes with every turn and a restart
/// loses nothing.

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/// What the assistant commissions. Free-form: an earlier version fixed the
/// fields a poster needs, which made every agent in the marketplace a poster
/// designer regardless of what it advertised.
export interface JobBrief {
  request: string;
  requirements: string[];
}

export type DeliverableKind = "svg" | "markdown" | "text";

export interface RuntimeAgent {
  id: string;
  name: string;
  role: "client" | "provider";
  address: `0x${string}`;
  service: {
    summary: string;
    priceUsdc: string;
    deliverable?: DeliverableKind;
    requirements: string[];
  } | null;
}

export interface HiredJob {
  jobId: string;
  providerName: string;
  amountUsdc: string;
  /// Carried from the provider that was hired, so the view knows whether to
  /// render the result as an image or as text without asking again.
  kind: DeliverableKind;
}

const GREETING: ChatMessage = {
  role: "assistant",
  content: "Tell me what you need and I'll find an agent to make it.",
};

export function useAssistant() {
  const { ready, signedIn } = useSession();
  const authedFetch = useAuthedFetch();
  const [agents, setAgents] = useState<RuntimeAgent[]>([]);
  const [client, setClient] = useState<RuntimeAgent | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [brief, setBrief] = useState<JobBrief | null>(null);
  // Which provider the agent chose while talking. Carried to the hire call so
  // the job goes to the agent whose terms the user was shown and approved.
  const [providerId, setProviderId] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [job, setJob] = useState<HiredJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Guards against a second send while one is in flight — the model takes a
  // second or two, and a double submit would interleave two histories.
  const busy = useRef(false);

  // The directory is public — an agent finds a counterparty by reading what
  // everyone offers, so this needs no sign-in.
  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/runtime/agents");
      if (!res.ok) throw new Error("the agent runtime is not reachable");
      setAgents((await res.json()) as RuntimeAgent[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not load agents");
    }
  }, []);

  /// Your own assistant, created on first sign-in and returned thereafter.
  ///
  /// Deliberately not the first client agent in the directory, which is what
  /// this did before owners existed: that hands everyone the same agent, so two
  /// people share one USDC balance and one conversation.
  const loadAssistant = useCallback(async () => {
    if (!signedIn) {
      setClient(null);
      return;
    }
    try {
      const res = await authedFetch("/api/runtime/agents/assistant", { method: "POST" });
      const body = (await res.json()) as RuntimeAgent | { error: string };
      if ("error" in body) throw new Error(body.error);
      setClient(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not reach your assistant");
    }
  }, [signedIn, authedFetch]);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  // Waits for `ready`: acting on a not-yet-restored session would create a
  // second assistant for a user who already has one.
  useEffect(() => {
    if (ready) void loadAssistant();
  }, [ready, loadAssistant]);

  const send = useCallback(
    async (text: string) => {
      if (!client || busy.current || text.trim().length === 0) return;
      busy.current = true;
      setError(null);

      const next = [...messages, { role: "user" as const, content: text.trim() }];
      setMessages(next);
      setThinking(true);

      try {
        const res = await authedFetch(`/api/runtime/agents/${client.id}/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: next }),
        });
        const body = (await res.json()) as
          | {
              message: string;
              ready: boolean;
              brief: JobBrief | null;
              providerId: string | null;
            }
          | { error: string };

        if ("error" in body) throw new Error(body.error);

        setMessages([...next, { role: "assistant", content: body.message }]);
        setBrief(body.ready ? body.brief : null);
        setProviderId(body.ready ? body.providerId : null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "the agent could not reply");
      } finally {
        setThinking(false);
        busy.current = false;
      }
    },
    [client, messages, authedFetch],
  );

  const hire = useCallback(async () => {
    if (!client || !brief || hiring) return;
    setHiring(true);
    setError(null);

    try {
      const res = await authedFetch(`/api/runtime/agents/${client.id}/hire`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief, providerId }),
      });
      const body = (await res.json()) as
        | {
            jobId: string;
            provider: { name: string; service: { deliverable?: DeliverableKind } | null };
            amount: string;
          }
        | { error: string };

      if ("error" in body) throw new Error(body.error);

      setJob({
        jobId: body.jobId,
        providerName: body.provider.name,
        // Minor units to a display string. Never through Number first: money is
        // integer arithmetic.
        amountUsdc: (BigInt(body.amount) / 1_000_000n).toString(),
        kind: body.provider.service?.deliverable ?? "svg",
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Commissioned ${body.provider.name} — job ${body.jobId}. The escrow is funded; I'll have the result once the evaluator signs off.`,
        },
      ]);
      setBrief(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not hire a provider");
    } finally {
      setHiring(false);
    }
  }, [client, brief, providerId, hiring, authedFetch]);

  const reset = useCallback(() => {
    setMessages([GREETING]);
    setBrief(null);
    setProviderId(null);
    setJob(null);
    setError(null);
  }, []);

  const providers = agents.filter((a) => a.role === "provider");

  return {
    client,
    providers,
    messages,
    brief,
    thinking,
    hiring,
    job,
    error,
    send,
    hire,
    reset,
    loadAgents,
    /// The view distinguishes "no assistant yet" from "sign in to get one".
    needsSignIn: ready && !signedIn,
  };
}

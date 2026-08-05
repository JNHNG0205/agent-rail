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

/// The jobs commissioned in this session, kept across reloads.
///
/// A list, not one slot. It held a single job until recently, so commissioning a
/// second replaced the first — and starting a new request cleared it outright,
/// which meant the ordinary way of asking for a second thing hid work that was
/// still running. Nothing was lost on chain; what was lost was the ability to
/// watch it, which is the entire purpose of this panel.
///
/// Several at once is also the more honest picture. Agents work concurrently and
/// independently, and a UI that can only show one at a time quietly claims
/// otherwise.
///
/// Deliberately only the jobs, not the conversation: a chat is cheap to start
/// again and a result is not.
const JOBS_KEY = "agentrail.jobs";

/// Enough to watch a few things at once without the panel becoming a history —
/// the Escrow Jobs tab is where every job ever lives.
const MAX_TRACKED = 4;

function loadJobs(): HiredJob[] {
  try {
    const raw = window.localStorage.getItem(JOBS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Tolerates the single-object shape this key used to hold, so an open tab
    // from before the change does not throw on its own stored data.
    if (Array.isArray(parsed)) return parsed as HiredJob[];
    return parsed && typeof parsed === "object" ? [parsed as HiredJob] : [];
  } catch {
    return [];
  }
}

function saveJobs(jobs: HiredJob[]): void {
  try {
    window.localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
  } catch {
    // A full or blocked store must not fail a commission that already happened
    // on chain — the job is real whether or not this is written.
  }
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
  const [jobs, setJobs] = useState<HiredJob[]>([]);
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

  // After mount, never during render: the server renders this too, and reading
  // localStorage there would either crash or produce markup the browser
  // disagrees with.
  useEffect(() => {
    setJobs(loadJobs());
  }, []);

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

      const hired: HiredJob = {
        jobId: body.jobId,
        providerName: body.provider.name,
        // Minor units to a display string. Never through Number first: money is
        // integer arithmetic.
        amountUsdc: (BigInt(body.amount) / 1_000_000n).toString(),
        kind: body.provider.service?.deliverable ?? "svg",
      };
      setJobs((prev) => {
        // Newest first, and never twice: hiring is idempotent from the caller's
        // side only in that the chain assigns one id, so a repeated response
        // must not produce a second card.
        const next = [hired, ...prev.filter((j) => j.jobId !== hired.jobId)].slice(0, MAX_TRACKED);
        saveJobs(next);
        return next;
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

  /// Stop showing a job. Only ever removes the card — the job is on chain and
  /// continues regardless, and the Escrow Jobs tab still has it.
  const dismissJob = useCallback((jobId: string) => {
    setJobs((prev) => {
      const next = prev.filter((j) => j.jobId !== jobId);
      saveJobs(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setMessages([GREETING]);
    setBrief(null);
    setProviderId(null);
    setError(null);
    // The jobs stay. "New request" starts a new conversation; it does not
    // abandon work that is still running and still owed to somebody.
  }, []);

  const providers = agents.filter((a) => a.role === "provider");

  return {
    client,
    providers,
    messages,
    brief,
    thinking,
    hiring,
    jobs,
    dismissJob,
    error,
    send,
    hire,
    reset,
    loadAgents,
    /// The view distinguishes "no assistant yet" from "sign in to get one".
    needsSignIn: ready && !signedIn,
  };
}

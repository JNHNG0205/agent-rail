"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/// Talking to your agent, and getting it to commission work. Member 4.
///
/// The conversation lives here rather than on the server: the runtime is
/// stateless by design, so the whole history goes with every turn and a restart
/// loses nothing.

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PosterBrief {
  title: string;
  subtitle: string;
  callToAction: string;
  palette: string;
  requirements: string[];
}

export interface RuntimeAgent {
  id: string;
  name: string;
  role: "client" | "provider";
  address: `0x${string}`;
  service: { summary: string; priceUsdc: string; requirements: string[] } | null;
}

export interface HiredJob {
  jobId: string;
  providerName: string;
  amountUsdc: string;
}

const GREETING: ChatMessage = {
  role: "assistant",
  content: "Tell me what you need and I'll find an agent to make it.",
};

export function useAssistant() {
  const [agents, setAgents] = useState<RuntimeAgent[]>([]);
  const [client, setClient] = useState<RuntimeAgent | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [brief, setBrief] = useState<PosterBrief | null>(null);
  const [thinking, setThinking] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [job, setJob] = useState<HiredJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Guards against a second send while one is in flight — the model takes a
  // second or two, and a double submit would interleave two histories.
  const busy = useRef(false);

  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/runtime/agents");
      if (!res.ok) throw new Error("the agent runtime is not reachable");
      const list = (await res.json()) as RuntimeAgent[];
      setAgents(list);
      setClient(list.find((a) => a.role === "client") ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not load agents");
    }
  }, []);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  const send = useCallback(
    async (text: string) => {
      if (!client || busy.current || text.trim().length === 0) return;
      busy.current = true;
      setError(null);

      const next = [...messages, { role: "user" as const, content: text.trim() }];
      setMessages(next);
      setThinking(true);

      try {
        const res = await fetch(`/api/runtime/agents/${client.id}/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: next }),
        });
        const body = (await res.json()) as
          | { message: string; ready: boolean; brief: PosterBrief | null }
          | { error: string };

        if ("error" in body) throw new Error(body.error);

        setMessages([...next, { role: "assistant", content: body.message }]);
        setBrief(body.ready ? body.brief : null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "the agent could not reply");
      } finally {
        setThinking(false);
        busy.current = false;
      }
    },
    [client, messages],
  );

  const hire = useCallback(async () => {
    if (!client || !brief || hiring) return;
    setHiring(true);
    setError(null);

    try {
      const res = await fetch(`/api/runtime/agents/${client.id}/hire`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const body = (await res.json()) as
        | { jobId: string; provider: { name: string }; amount: string }
        | { error: string };

      if ("error" in body) throw new Error(body.error);

      setJob({
        jobId: body.jobId,
        providerName: body.provider.name,
        // Minor units to a display string. Never through Number first: money is
        // integer arithmetic.
        amountUsdc: (BigInt(body.amount) / 1_000_000n).toString(),
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
  }, [client, brief, hiring]);

  const reset = useCallback(() => {
    setMessages([GREETING]);
    setBrief(null);
    setJob(null);
    setError(null);
  }, []);

  const providers = agents.filter((a) => a.role === "provider");

  return { client, providers, messages, brief, thinking, hiring, job, error, send, hire, reset, loadAgents };
}

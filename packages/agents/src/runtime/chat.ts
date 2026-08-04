import type { PosterBrief } from "@agentrail/shared";
import { completeJson, type JsonSchema } from "../lib/llm.js";
import type { AgentRecord } from "./store.js";
import type { ServiceOffer } from "./store.js";

/// Talking to your own agent, until it knows enough to commission work.
///
/// This is the step between "I want a poster" and a job on chain. The agent asks
/// for whatever is missing and, once it has enough, returns a brief ready to
/// hire against.
///
/// It runs here rather than in the browser because the model key must not reach
/// a client, and because the agent doing the talking is the same one that will
/// spend the money — the conversation and the commission belong together.

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatReply {
  message: string;
  /// True once enough is known to hire. The caller decides whether to act on it.
  ready: boolean;
  brief: PosterBrief | null;
}

interface RawReply {
  message: string;
  ready: boolean;
  title: string;
  subtitle: string;
  callToAction: string;
  palette: string;
}

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "Your reply to the user. One or two sentences, plain language.",
    },
    ready: {
      type: "boolean",
      description: "True only when title, subtitle, call to action and palette are all known.",
    },
    title: { type: "string", description: "Poster headline. Empty string until known." },
    subtitle: { type: "string", description: "Supporting line. Empty string until known." },
    callToAction: { type: "string", description: "What the reader should do. Empty until known." },
    palette: {
      type: "string",
      description:
        "Exactly two colours, e.g. 'deep blue and amber'. More than two and the poster will miss one.",
    },
  },
  required: ["message", "ready", "title", "subtitle", "callToAction", "palette"],
  additionalProperties: false,
} as const satisfies JsonSchema;

function isRawReply(value: unknown): value is RawReply {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.message === "string" &&
    typeof v.ready === "boolean" &&
    typeof v.title === "string" &&
    typeof v.subtitle === "string" &&
    typeof v.callToAction === "string" &&
    typeof v.palette === "string"
  );
}

export function isChatHistory(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 40 &&
    value.every(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
        typeof (m as ChatMessage).content === "string" &&
        (m as ChatMessage).content.length > 0 &&
        (m as ChatMessage).content.length <= 4_000,
    )
  );
}

function systemPrompt(agent: AgentRecord, offers: ServiceOffer[]): string {
  const market =
    offers.length > 0
      ? offers.map((o) => `- ${o.summary} (${o.priceUsdc} USDC), graded on: ${o.requirements.join("; ")}`)
      : ["- nothing is on offer yet"];

  return [
    `You are "${agent.name}", an AI agent acting for one person.`,
    "You do not do the work yourself. You hire another agent, and a third,",
    "independent agent grades the result against the brief you write — so the",
    "brief must be specific and achievable, not aspirational.",
    "",
    "Available from other agents right now:",
    ...market,
    "",
    "Ask for whatever is missing, one short question at a time. Set ready to true",
    "only once title, subtitle, call to action and palette are all known.",
    "Name exactly two colours: the evaluator rejects a poster that misses any",
    "colour the brief asks for, so a longer list makes rejection near certain.",
  ].join("\n");
}

/// One turn. The caller owns the history, so this stays stateless and a restart
/// loses nothing.
export async function chat(opts: {
  agent: AgentRecord;
  history: ChatMessage[];
  offers: ServiceOffer[];
  /// The requirements a brief is graded against, taken from the provider that
  /// would be hired. Never model-generated: what is judged has to be what was
  /// advertised.
  requirements: string[];
}): Promise<ChatReply> {
  const transcript = opts.history
    .map((m) => `${m.role === "user" ? "User" : "Agent"}: ${m.content}`)
    .join("\n");

  const raw = await completeJson<RawReply>(
    {
      system: systemPrompt(opts.agent, opts.offers),
      user: `${transcript}\n\nReply as the agent.`,
      maxTokens: 800,
      schemaName: "agent_reply",
      schema: REPLY_SCHEMA,
      mock: {
        message: "Got it — a demo day poster in deep blue and amber. Ready to commission.",
        ready: true,
        title: "AgentRail Demo Day",
        subtitle: "Autonomous agents settling payments on chain",
        callToAction: "Join us",
        palette: "deep blue and amber",
      },
    },
    isRawReply,
  );

  return {
    message: raw.message,
    ready: raw.ready,
    brief: raw.ready
      ? {
          title: raw.title,
          subtitle: raw.subtitle,
          callToAction: raw.callToAction,
          palette: raw.palette,
          requirements: opts.requirements,
        }
      : null,
  };
}

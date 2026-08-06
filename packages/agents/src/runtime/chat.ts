import type { JobBrief } from "@agentrail/shared";
import { completeJson, type JsonSchema } from "../lib/llm.js";
import type { AgentRecord } from "./store.js";
import type { ServiceOffer } from "./store.js";

/// Talking to your own agent, until it knows enough to commission work.
///
/// This is the step between what a person asks for and a job on chain. The agent
/// asks for whatever is missing and, once it has enough, returns a brief ready
/// to hire against.
///
/// It runs here rather than in the browser because the model key must not reach
/// a client, and because the agent doing the talking is the same one that will
/// spend the money — the conversation and the commission belong together.
///
/// What can be commissioned is whatever is on offer, read from the directory at
/// the time of the conversation. The agent is deliberately not told what kind of
/// work exists: this asked for a poster's title, subtitle, call to action and
/// palette until recently, which quietly made the whole marketplace a poster
/// marketplace — an agent selling anything else could never be hired through
/// here, however it described itself.

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatReply {
  message: string;
  /// True once enough is known to hire. The caller decides whether to act on it.
  ready: boolean;
  brief: JobBrief | null;
  /// The provider the agent means to hire. Chosen by the agent from what is on
  /// offer — picking a counterparty is the thing it is for. Null until ready.
  providerId: string | null;
}

interface RawReply {
  message: string;
  ready: boolean;
  request: string;
  providerId: string;
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
      description:
        "True only when the provider could produce the right thing from the request below without asking anything further.",
    },
    request: {
      type: "string",
      description:
        "What the user wants, in your own words, including every detail they gave. Empty string until ready. Describe ONLY the work itself — never repeat the catalogue entry, the price or the grading terms, which the provider already knows. This is all the provider is told, so anything missing here is missing from the work.",
    },
    providerId: {
      type: "string",
      description:
        "The id in [brackets] of the agent you will hire, copied exactly from the list. Choose the one whose service actually covers the request. Empty string until ready.",
    },
  },
  required: ["message", "ready", "request", "providerId"],
  additionalProperties: false,
} as const satisfies JsonSchema;

function isRawReply(value: unknown): value is RawReply {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.message === "string" &&
    typeof v.ready === "boolean" &&
    typeof v.request === "string" &&
    typeof v.providerId === "string"
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

function systemPrompt(agent: AgentRecord, offers: ProviderOffer[]): string {
  const market =
    offers.length > 0
      ? offers.map(
          (o) =>
            `- [${o.id}] ${o.service.summary} (${o.service.priceUsdc} USDC), delivered as ${o.service.deliverable ?? "svg"}, graded on: ${o.service.requirements.join("; ")}`,
        )
      : ["- nothing is on offer yet"];

  return [
    `You are "${agent.name}", an AI agent acting for one person.`,
    "You do not do the work yourself. You hire another agent, and a third,",
    "independent agent grades the result against the brief you write.",
    "",
    "Available from other agents right now:",
    ...market,
    "",
    "FIRST, before anything else, decide whether one of those services actually",
    "covers what is being asked for. If none does, say so plainly, say what is",
    "available instead, and stop. Do NOT ask for details: no amount of detail",
    "makes an unavailable service available, and asking implies you can do it.",
    "Promising work nobody sells escrows real money against a delivery that",
    "cannot meet anyone's published terms — the person loses either the money",
    "or the time until the job times out.",
    "",
    "If one does cover it, choose that agent and give its id in providerId.",
    "Cheapest is not the answer: an agent hired for work it does not do will",
    "deliver the wrong thing and fail its own terms, and the money is escrowed",
    "before any of that is known.",
    "",
    "Then be brief. The provider is capable and already knows its own trade, and",
    "the terms it is graded against are published above — you do not need to",
    "restate them or design the work. Set ready to true as soon as the provider",
    "could make a reasonable attempt that satisfies those terms.",
    "",
    "Most requests need no questions at all. Ask only when the work genuinely",
    "cannot be produced without the answer — a poster with no words to put on",
    "it. Do not ask for preferences the provider can choose itself, and never",
    "ask more than one question in a row. If someone says a request is simple,",
    "or tells you to go ahead, that is your answer: commission it.",
  ].join("\n");
}

/// One turn. The caller owns the history, so this stays stateless and a restart
/// loses nothing.
export interface ProviderOffer {
  id: string;
  service: ServiceOffer;
}

export async function chat(opts: {
  agent: AgentRecord;
  history: ChatMessage[];
  offers: ProviderOffer[];
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
        message: "Got it — ready to commission that.",
        ready: true,
        request:
          "A poster for AgentRail Demo Day, subtitled 'Autonomous agents settling payments on chain', calling the reader to join us, in deep blue and amber.",
        providerId: opts.offers[0]?.id ?? "",
      },
    },
    isRawReply,
  );

  // The model names a provider; it does not get to invent one. An id that is
  // not on offer falls back to the cheapest, which is the old behaviour and
  // still better than failing the conversation.
  const chosen =
    opts.offers.find((o) => o.id === raw.providerId) ?? (raw.ready ? opts.offers[0] : undefined);

  return {
    message: raw.message,
    ready: raw.ready,
    providerId: raw.ready ? (chosen?.id ?? null) : null,
    // The terms come from the chosen provider, never from the model. Showing a
    // different provider's terms would ask the user to approve a commission
    // under conditions that will not apply to it.
    brief: raw.ready
      ? { request: raw.request, requirements: chosen?.service.requirements ?? [] }
      : null,
  };
}

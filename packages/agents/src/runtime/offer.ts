import {
  DELIVERABLE_KINDS,
  SERVICE_CATEGORIES,
  isDeliverableKind,
  isServiceCategory,
  type DeliverableKind,
  type ServiceCategory,
} from "@agentrail/shared";
import { completeJson, type JsonSchema } from "../lib/llm.js";
import type { ServiceOffer } from "./store.js";

/// Turn "what this agent does" into terms an evaluator can actually enforce.
///
/// A person describes a service in a sentence. The evaluator needs something
/// else entirely: checkable statements it can hold a deliverable against. "makes
/// good posters" cannot be judged, so a job graded on it settles or refunds
/// essentially at random — which would make the escrow theatre.
///
/// So the model proposes concrete terms and a price, and the person confirms or
/// edits them. Proposing rather than deciding matters: the agent's creator is
/// the one who has to live with what it promised.

export interface RawOffer {
  summary: string;
  priceUsdc: string;
  deliverable: string;
  category: string;
  requirements: string[];
}

const OFFER_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "One sentence naming the deliverable, as the seller would advertise it.",
    },
    priceUsdc: {
      type: "string",
      description: "A whole number of USDC between 1 and 100, as a string.",
    },
    category: {
      type: "string",
      enum: [...SERVICE_CATEGORIES],
      description:
        "The kind of work, for people browsing a directory. Judge by what is produced, not by the file format — code delivered as Markdown is still code.",
    },
    deliverable: {
      type: "string",
      enum: [...DELIVERABLE_KINDS],
      description:
        "The form the work takes. 'svg' for anything drawn — posters, diagrams, logos. 'markdown' for structured documents. 'text' for everything else, including prose, code and markup such as HTML.",
    },
    requirements: {
      type: "array",
      items: { type: "string" },
      description:
        "Three or four short statements an evaluator can check by reading the delivered file. Each must be objectively true or false — 'shows the title text', not 'looks professional' — and must hold for EVERY job this agent takes. Where the buyer chooses the value, refer to their request ('uses the colours the buyer asked for') rather than naming one ('uses red'), which would bind every future delivery to it.",
    },
  },
  required: ["summary", "priceUsdc", "deliverable", "category", "requirements"],
  additionalProperties: false,
} as const satisfies JsonSchema;

function isRawOffer(value: unknown): value is RawOffer {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.summary === "string" &&
    v.summary.length > 0 &&
    typeof v.priceUsdc === "string" &&
    /^\d+(\.\d+)?$/.test(v.priceUsdc) &&
    isDeliverableKind(v.deliverable) &&
    isServiceCategory(v.category) &&
    Array.isArray(v.requirements) &&
    v.requirements.length >= 2 &&
    v.requirements.every((r) => typeof r === "string" && r.length > 0)
  );
}

const SYSTEM = [
  "You define what an AI provider agent sells.",
  "",
  "Choose the form the work takes from what is offered, based on what the agent",
  "actually does — a designer delivers svg, a writer of structured documents",
  "delivers markdown, and anything else, including prose, code and markup such as",
  "HTML, delivers text.",
  "",
  "A separate evaluator agent grades every delivery against the requirements you",
  "write, and releases escrowed payment only if they are met — so each",
  "requirement must be something that agent can verify by reading the delivered",
  "work itself.",
  "",
  "These requirements are published once, when the agent is created, and then",
  "applied unchanged to every job it ever takes. Write what the seller guarantees",
  "about any delivery, never a detail that one buyer happens to want.",
  "",
  "So when the buyer is the one who chooses something — the colours, the title,",
  "the subject, the length — refer to their request instead of naming a value:",
  "'uses the colours the buyer asked for', never 'uses red'. A named value",
  "becomes a promise this agent must keep on every future job, and the next buyer",
  "who wants something else gets a refund for work that was actually correct.",
  "",
  "Write three or four. Each must be objectively true or false from reading the",
  "delivered work: 'includes a heading' is checkable, 'looks professional' is",
  "not. Prefer requirements about content that is present, because absence is",
  "what an evaluator can detect.",
].join("\n");

/// A service offer proposed from a plain-language purpose.
export async function proposeOffer(name: string, purpose: string): Promise<ServiceOffer> {
  const raw = await completeJson<RawOffer>(
    {
      system: SYSTEM,
      user: `Agent name: ${name}\nWhat it does: ${purpose}\n\nPropose its service.`,
      maxTokens: 700,
      schemaName: "service_offer",
      schema: OFFER_SCHEMA,
      mock: {
        summary: "One poster delivered as a self-contained SVG document",
        priceUsdc: "10",
        deliverable: "svg",
        category: "design",
        requirements: [
          "shows the title text",
          "shows the subtitle text",
          "shows the call to action",
          "uses the requested palette",
        ],
      },
    },
    isRawOffer,
  );

  return normaliseOffer(raw);
}

/// Bring a proposal within the bounds the rest of the system assumes.
///
/// Separate from the request so it can be tested without a model, and applied
/// after it so a provider that ignores the schema still cannot register terms
/// nothing can satisfy.
export function normaliseOffer(raw: RawOffer): ServiceOffer {
  return {
    summary: raw.summary.trim(),
    priceUsdc: String(Math.max(1, Math.min(100, Math.round(Number(raw.priceUsdc))))),
    deliverable: raw.deliverable as DeliverableKind,
    category: raw.category as ServiceCategory,
    // Four is the ceiling: each one is another chance to reject, and a provider
    // that fails most of its jobs is not a demonstration of anything. Blank
    // entries are dropped before the cap, so a stray empty string cannot use up
    // one of the four and leave the agent graded on three.
    requirements: raw.requirements
      .map((r) => r.trim())
      .filter((r) => r.length > 0)
      .slice(0, 4),
  };
}

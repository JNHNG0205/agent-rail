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

interface RawOffer {
  summary: string;
  priceUsdc: string;
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
    requirements: {
      type: "array",
      items: { type: "string" },
      description:
        "Three or four short statements an evaluator can check by looking at the delivered file. Each must be objectively true or false — 'shows the title text', not 'looks professional'.",
    },
  },
  required: ["summary", "priceUsdc", "requirements"],
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
    Array.isArray(v.requirements) &&
    v.requirements.length >= 2 &&
    v.requirements.every((r) => typeof r === "string" && r.length > 0)
  );
}

const SYSTEM = [
  "You define what an AI provider agent sells.",
  "",
  "The agent delivers a single self-contained SVG document. A separate evaluator",
  "agent grades every delivery against the requirements you write, and releases",
  "escrowed payment only if they are met — so each requirement must be something",
  "that agent can verify by reading the file.",
  "",
  "Write three or four. Each must be objectively true or false: 'shows the title",
  "text' is checkable, 'looks professional' is not. Prefer requirements about",
  "content that is present, because absence is what an evaluator can detect.",
  "",
  "Keep colour requirements to one line naming at most two colours — a delivery",
  "that misses any colour named will be rejected, so more colours means more",
  "rejections.",
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

  return {
    summary: raw.summary,
    priceUsdc: String(Math.max(1, Math.min(100, Math.round(Number(raw.priceUsdc))))),
    // Four is the ceiling: each one is another chance to reject, and a provider
    // that fails most of its jobs is not a demonstration of anything.
    requirements: raw.requirements.slice(0, 4),
  };
}

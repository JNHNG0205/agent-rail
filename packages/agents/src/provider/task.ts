import type { DeliverableKind, JobBrief } from "@agentrail/shared";
import { completeValidated, stripFences } from "../lib/llm.js";
import { isAcceptableSvg, unsafeReason } from "./svg.js";

/// Doing the work a provider was hired for.
///
/// The provider's own published summary is what tells it what it sells, rather
/// than this file knowing. It used to be a poster designer and nothing else,
/// which made every agent in the marketplace a poster designer whatever its
/// owner wrote when creating it.
///
/// The output kind is declared, not guessed, because three things downstream
/// depend on knowing it: what counts as a well-formed reply, what the evaluator
/// is looking at, and how the browser renders it.

interface Rules {
  system: string;
  /// Rejected replies are retried rather than thrown on, so this says what a
  /// good one looks like in the words the model gets back.
  expectation: string;
  accept: (value: string) => boolean;
}

const SVG_RULES: Rules = {
  system: [
    "You produce complete SVG documents.",
    "",
    "Rules:",
    "- Reply with ONE complete SVG document and nothing else. No prose, no markdown fences.",
    "- Start with <svg and end with </svg>.",
    '- Use viewBox="0 0 600 800". Do not reference external fonts, images or stylesheets.',
    "- Render every piece of text given in the brief, legibly and in full.",
  ].join("\n"),
  expectation:
    "the reply must be a complete SVG document with no script, event handlers or remote references",
  accept: isAcceptableSvg,
};

const MARKDOWN_RULES: Rules = {
  system: [
    "You produce documents in Markdown.",
    "",
    "Rules:",
    "- Reply with the document itself and nothing else. No preamble, no commentary about it.",
    "- Use headings, lists and emphasis where they help a reader, not for decoration.",
    "- Do not reference external images or link to pages you cannot verify exist.",
  ].join("\n"),
  expectation: "the reply must be the finished document in Markdown, with no preamble",
  accept: (value) => value.trim().length >= 40,
};

const TEXT_RULES: Rules = {
  system: [
    "You produce plain text.",
    "",
    "Rules:",
    "- Reply with the finished work and nothing else. No preamble, no commentary about it.",
    "- No markup, no code fences.",
  ].join("\n"),
  expectation: "the reply must be the finished work as plain text, with no preamble",
  accept: (value) => value.trim().length >= 20,
};

const RULES: Record<DeliverableKind, Rules> = {
  svg: SVG_RULES,
  markdown: MARKDOWN_RULES,
  text: TEXT_RULES,
};

/// Escape `&` first so entities introduced by this pass aren't re-escaped.
function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/// Stands in for a model when none is configured, so a fresh clone runs offline.
/// It has to satisfy the same acceptance check as a real reply — a mock that
/// would be rejected in production hides the failure until the demo.
function mockDeliverable(kind: DeliverableKind, brief: JobBrief): string {
  if (kind === "svg") {
    const request = escapeXml(brief.request.slice(0, 60));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
  <rect width="600" height="800" fill="#F4F1EA"/>
  <text x="300" y="300" text-anchor="middle" font-family="Georgia" font-size="32" fill="#9C4722">${request}</text>
  <text x="300" y="620" text-anchor="middle" font-family="Georgia" font-size="20" fill="#3A3A3A">${escapeXml(
    brief.requirements[0] ?? "",
  )}</text>
</svg>`;
  }
  const body = [
    `Delivered work for: ${brief.request}`,
    "",
    ...brief.requirements.map((r) => `- ${r}`),
  ].join("\n");
  return kind === "markdown" ? `# Delivered\n\n${body}` : body;
}

export interface TaskOptions {
  kind: DeliverableKind;
  /// The provider's published summary — what it sells, in its own words. This is
  /// what makes one provider a designer and another a copywriter.
  service: string;
  brief: JobBrief;
}

function renderBrief(brief: JobBrief): string {
  return [
    "Request:",
    brief.request,
    "",
    "The delivered work must satisfy all of:",
    ...brief.requirements.map((r) => `- ${r}`),
  ].join("\n");
}

/// Produce the work this provider was hired for.
export async function runTask(opts: TaskOptions): Promise<string> {
  const rules = RULES[opts.kind];
  const system = [
    `You are an AI agent hired to do one job. You provide: ${opts.service}`,
    "",
    rules.system,
  ].join("\n");

  // Retried rather than thrown on: this runs after the job is funded, so giving
  // up on one bad generation strands real escrow until the timeout. Models do
  // return a half-finished document and stop.
  const output = await completeValidated(
    {
      system,
      user: renderBrief(opts.brief),
      mock: mockDeliverable(opts.kind, opts.brief),
      maxTokens: 4000,
    },
    rules.accept,
    rules.expectation,
    stripFences,
  );

  // Checked, not sanitised. The hash of exactly these bytes goes on chain and
  // the evaluator grades exactly these bytes, so rewriting the content here
  // would leave the three disagreeing. A reply that fails is retried instead —
  // see svg.ts for what is refused and why.
  if (opts.kind === "svg") {
    const unsafe = unsafeReason(output);
    if (unsafe) throw new Error(`provider produced an unsafe SVG: ${unsafe}`);
  }
  return output;
}

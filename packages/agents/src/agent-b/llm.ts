import type { PosterBrief } from "@agentrail/shared";
import { complete, stripFences } from "../lib/llm.js";

const SYSTEM = `You are a graphic designer agent. You produce poster designs as SVG.

Rules:
- Reply with ONE complete SVG document and nothing else. No prose, no markdown fences.
- Start with <svg and end with </svg>.
- Use viewBox="0 0 600 800". Do not reference external fonts, images or stylesheets.
- Render every piece of text given in the brief, legibly and in full.`;

function renderBrief(brief: PosterBrief): string {
  return [
    `Title: ${brief.title}`,
    `Subtitle: ${brief.subtitle}`,
    `Call to action: ${brief.callToAction}`,
    `Palette: ${brief.palette}`,
    "",
    "The poster must satisfy all of:",
    ...brief.requirements.map((r) => `- ${r}`),
  ].join("\n");
}

/// Escape `&` first so entities introduced by this pass aren't re-escaped.
function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mockPoster(brief: PosterBrief): string {
  const title = escapeXml(brief.title);
  const subtitle = escapeXml(brief.subtitle);
  const callToAction = escapeXml(brief.callToAction);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
  <rect width="600" height="800" fill="#F4F1EA"/>
  <text x="300" y="300" text-anchor="middle" font-family="Georgia" font-size="44" fill="#9C4722">${title}</text>
  <text x="300" y="360" text-anchor="middle" font-family="Georgia" font-size="24" fill="#3A3A3A">${subtitle}</text>
  <text x="300" y="620" text-anchor="middle" font-family="Georgia" font-size="28" fill="#9C4722">${callToAction}</text>
</svg>`;
}

/// Generate the poster Agent B was hired to produce.
export async function runTask(brief: PosterBrief): Promise<string> {
  const raw = await complete({
    system: SYSTEM,
    user: renderBrief(brief),
    mock: mockPoster(brief),
    maxTokens: 4000,
  });

  const svg = stripFences(raw);
  if (!svg.startsWith("<svg") || !svg.endsWith("</svg>")) {
    throw new Error(`provider returned non-SVG content: ${svg.slice(0, 80)}`);
  }
  // TODO(M3): this only checks the outer tags, e.g. "<svg><script>...</script></svg>" would
  //           pass. The returned string is untrusted provider output — sanitise it before
  //           rendering as HTML in the web UI; do not trust it as safe markup as-is.
  return svg;
}

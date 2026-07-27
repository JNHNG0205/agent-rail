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

function mockPoster(brief: PosterBrief): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
  <rect width="600" height="800" fill="#F4F1EA"/>
  <text x="300" y="300" text-anchor="middle" font-family="Georgia" font-size="44" fill="#9C4722">${brief.title}</text>
  <text x="300" y="360" text-anchor="middle" font-family="Georgia" font-size="24" fill="#3A3A3A">${brief.subtitle}</text>
  <text x="300" y="620" text-anchor="middle" font-family="Georgia" font-size="28" fill="#9C4722">${brief.callToAction}</text>
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
  if (!svg.startsWith("<svg") || !svg.includes("</svg>")) {
    throw new Error(`provider returned non-SVG content: ${svg.slice(0, 80)}`);
  }
  return svg;
}

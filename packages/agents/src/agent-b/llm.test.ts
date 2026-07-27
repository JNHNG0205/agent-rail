import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { PosterBrief } from "@agentrail/shared";
import { runTask } from "./llm.js";

const BRIEF: PosterBrief = {
  title: "AgentRail Demo Day",
  subtitle: "Autonomous agent settlement",
  callToAction: "Join us",
  palette: "warm terracotta on cream",
  requirements: ["shows the title", "shows the call to action"],
};

beforeEach(() => {
  process.env.LLM_PROVIDER = "mock";
});

test("returns SVG source", async () => {
  const svg = await runTask(BRIEF);
  assert.ok(svg.startsWith("<svg"), `expected SVG, got: ${svg.slice(0, 40)}`);
  assert.ok(svg.includes("</svg>"));
});

test("mock poster includes the brief title so review can pass end to end", async () => {
  const svg = await runTask(BRIEF);
  assert.ok(svg.includes(BRIEF.title));
});

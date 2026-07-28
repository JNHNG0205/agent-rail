import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { PosterBrief } from "@agentrail/shared";
import { hashDeliverable } from "../lib/hash.js";
import { review } from "./review.js";

const realFetch = globalThis.fetch;

const BRIEF: PosterBrief = {
  title: "AgentRail Demo Day",
  subtitle: "Autonomous agent settlement",
  callToAction: "Join us",
  palette: "warm terracotta on cream",
  requirements: ["shows the title"],
};

const SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>";

beforeEach(() => {
  process.env.LLM_PROVIDER = "mock";
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("approves when the hash matches", async () => {
  const result = await review(BRIEF, SVG, hashDeliverable(SVG));
  assert.equal(result.approve, true);
});

test("rejects on hash mismatch without calling the LLM", async () => {
  process.env.LLM_PROVIDER = "openrouter";
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_MODEL = "test-model";

  let callCount = 0;
  globalThis.fetch = (async () => {
    callCount += 1;
    throw new Error("network should not be reached");
  }) as typeof fetch;

  const wrong = hashDeliverable("something else entirely");
  const result = await review(BRIEF, SVG, wrong);

  assert.equal(result.approve, false);
  assert.match(result.reason, /hash/i);
  assert.equal(callCount, 0, "the deterministic gate must short-circuit before any LLM call");
});

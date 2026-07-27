import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { PosterBrief } from "@agentrail/shared";
import { reviewDeliverable, isDeliverableReview } from "./llm.js";

const realFetch = globalThis.fetch;

const BRIEF: PosterBrief = {
  title: "AgentRail Demo Day",
  subtitle: "Autonomous agent settlement",
  callToAction: "Join us",
  palette: "warm terracotta on cream",
  requirements: ["shows the title"],
};

beforeEach(() => {
  process.env.LLM_PROVIDER = "mock";
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.LLM_PROVIDER;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_MODEL;
});

test("returns a review with a reason populated", async () => {
  const review = await reviewDeliverable(BRIEF, "<svg></svg>");
  assert.ok(isDeliverableReview(review));
  assert.ok(review.reason.length > 0, "reason must be populated even on approval");
});

test("returns approve:false instead of throwing when the model reply is malformed", async () => {
  process.env.LLM_PROVIDER = "openrouter";
  process.env.LLM_API_KEY = "sk-or-test";
  process.env.LLM_MODEL = "some/model";
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: "not json at all" } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;

  const review = await reviewDeliverable(BRIEF, "<svg></svg>");
  assert.equal(review.approve, false);
  assert.match(review.reason, /parse/i);
});

test("isDeliverableReview rejects malformed objects", () => {
  assert.equal(isDeliverableReview({ approve: true }), false);
  assert.equal(isDeliverableReview(null), false);
});

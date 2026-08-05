import { test, beforeEach, afterEach } from "node:test";
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

const realFetch = globalThis.fetch;

beforeEach(() => {
  process.env.LLM_PROVIDER = "mock";
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.LLM_PROVIDER;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_MODEL;
});

function stubFetch(content: string) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

test("returns SVG source", async () => {
  const svg = await runTask(BRIEF);
  assert.ok(svg.startsWith("<svg"), `expected SVG, got: ${svg.slice(0, 40)}`);
  assert.ok(svg.includes("</svg>"));
});

test("mock poster includes the brief title so review can pass end to end", async () => {
  const svg = await runTask(BRIEF);
  assert.ok(svg.includes(BRIEF.title));
});

test("mock poster escapes XML special characters in the brief title", async () => {
  const brief: PosterBrief = { ...BRIEF, title: "Rock & Roll < Jazz" };
  const svg = await runTask(brief);
  assert.ok(svg.includes("Rock &amp; Roll &lt; Jazz"));
  assert.ok(!svg.includes("Rock & Roll < Jazz"));
});

test("rejects a provider response with trailing content after </svg>", async () => {
  process.env.LLM_PROVIDER = "openrouter";
  process.env.LLM_API_KEY = "sk-or-test";
  process.env.LLM_MODEL = "some/model";
  stubFetch("<svg></svg><script>x</script>");
  await assert.rejects(() => runTask(BRIEF), /complete SVG document/);
});

test("rejects a prose provider response with no SVG at all", async () => {
  process.env.LLM_PROVIDER = "openrouter";
  process.env.LLM_API_KEY = "sk-or-test";
  process.env.LLM_MODEL = "some/model";
  stubFetch("Sorry, I can't help with that request.");
  await assert.rejects(() => runTask(BRIEF), /complete SVG document/);
});

test("retries once and accepts a valid SVG on the second attempt", async () => {
  process.env.LLM_PROVIDER = "openrouter";
  process.env.LLM_API_KEY = "sk-or-test";
  process.env.LLM_MODEL = "some/model";

  // A real observation, not a hypothetical: the model returns a half-written
  // document and stops, reporting finish_reason "stop" well under the token
  // limit. This runs after the job is funded, so failing on the first attempt
  // would strand real escrow until the timeout.
  const replies = ['<svg viewBox="0 0 600 800"><text fill', "<svg>ok</svg>"];
  let calls = 0;
  globalThis.fetch = (async () => {
    const content = replies[calls] ?? "";
    calls += 1;
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const svg = await runTask(BRIEF);
  assert.equal(svg, "<svg>ok</svg>");
  assert.equal(calls, 2, "expected the truncated first reply to be retried");
});

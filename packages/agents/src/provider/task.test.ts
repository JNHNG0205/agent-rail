import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { JobBrief } from "@agentrail/shared";
import { runTask } from "./task.js";

/// Doing the work, whatever the work is.
///
/// The provider used to be a poster designer and nothing else. These cover both
/// halves of the change: the SVG path still behaves exactly as it did — same
/// completeness check, same retry, same refusal to sanitise — and a provider
/// selling something else is no longer forced through it.

const BRIEF: JobBrief = {
  request: "A poster for AgentRail Demo Day, calling the reader to join us",
  requirements: ["shows the title", "shows the call to action"],
};

const SVG = { kind: "svg" as const, service: "posters as SVG", brief: BRIEF };

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

function useModel() {
  process.env.LLM_PROVIDER = "openrouter";
  process.env.LLM_API_KEY = "sk-or-test";
  process.env.LLM_MODEL = "some/model";
}

test("an svg provider returns SVG source", async () => {
  const svg = await runTask(SVG);
  assert.ok(svg.startsWith("<svg"), `expected SVG, got: ${svg.slice(0, 40)}`);
  assert.ok(svg.includes("</svg>"));
});

test("the mock carries the request through, so review can pass end to end", async () => {
  const svg = await runTask(SVG);
  assert.ok(svg.includes("A poster for AgentRail Demo Day"));
});

test("the mock escapes XML special characters from the request", async () => {
  // The request is user-written and lands inside an XML document. Unescaped, a
  // stray `&` makes the SVG malformed and the completeness check rejects it —
  // so this protects the offline path from failing on ordinary punctuation.
  const svg = await runTask({
    ...SVG,
    brief: { ...BRIEF, request: "Rock & Roll < Jazz" },
  });
  assert.ok(svg.includes("Rock &amp; Roll &lt; Jazz"));
  assert.ok(!svg.includes("Rock & Roll < Jazz"));
});

test("rejects a response with trailing content after </svg>", async () => {
  useModel();
  stubFetch("<svg></svg><script>x</script>");
  await assert.rejects(() => runTask(SVG), /complete SVG document/);
});

test("rejects a prose response with no SVG at all", async () => {
  useModel();
  stubFetch("Sorry, I can't help with that request.");
  await assert.rejects(() => runTask(SVG), /complete SVG document/);
});

test("retries once and accepts a valid SVG on the second attempt", async () => {
  useModel();
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

  const svg = await runTask(SVG);
  assert.equal(svg, "<svg>ok</svg>");
  assert.equal(calls, 2, "expected the truncated first reply to be retried");
});

test("a markdown provider is not held to the SVG rules", async () => {
  // The point of the whole change. Under the old provider this reply was
  // rejected and retried until it gave up, because the only acceptable answer
  // was an SVG document — whatever the agent said it sold.
  useModel();
  stubFetch("# Launch plan\n\nA week-by-week plan for the launch, with owners.");
  const doc = await runTask({
    kind: "markdown",
    service: "launch plans as Markdown documents",
    brief: { request: "a launch plan", requirements: ["names an owner per week"] },
  });
  assert.ok(doc.startsWith("# Launch plan"));
});

test("a text provider is not held to the SVG rules either", async () => {
  useModel();
  stubFetch("Ship on the fourteenth. Tell the mailing list a week before.");
  const text = await runTask({
    kind: "text",
    service: "short advisory notes",
    brief: { request: "when to ship", requirements: ["names a date"] },
  });
  assert.ok(text.includes("fourteenth"));
});

test("what the provider sells reaches the model as its instructions", async () => {
  // Two providers with the same brief must not do the same thing. The service
  // summary is the only thing distinguishing them, so it has to arrive.
  useModel();
  let systemPrompt = "";
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      messages: { role: string; content: string }[];
    };
    systemPrompt = body.messages.find((m) => m.role === "system")?.content ?? "";
    const reply = "There once was a compiler so keen, it optimised all that it seen.";
    return new Response(JSON.stringify({ choices: [{ message: { content: reply } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  await runTask({
    kind: "text",
    service: "limericks about compilers",
    brief: { request: "one limerick", requirements: ["rhymes"] },
  });
  assert.ok(
    systemPrompt.includes("limericks about compilers"),
    `service missing from system prompt: ${systemPrompt.slice(0, 120)}`,
  );
});

test("an empty reply is rejected rather than delivered", async () => {
  // Whatever the kind. An accepted empty deliverable would be hashed, committed
  // on chain and graded — and the escrow settled or refunded on nothing.
  useModel();
  stubFetch("   ");
  await assert.rejects(() =>
    runTask({
      kind: "text",
      service: "notes",
      brief: { request: "a note", requirements: ["says something"] },
    }),
  );
});

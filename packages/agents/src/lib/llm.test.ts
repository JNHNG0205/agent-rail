import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { complete, completeJson } from "./llm.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.LLM_PROVIDER;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_MODEL;
});

function stubFetch(content: string) {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return () => calls;
}

test("mock provider returns the mock verbatim without any network call", async () => {
  process.env.LLM_PROVIDER = "mock";
  const calls = stubFetch("SHOULD NOT BE USED");
  const out = await complete({ system: "s", user: "u", mock: "canned" });
  assert.equal(out, "canned");
  assert.equal(calls(), 0);
});

test("openrouter provider throws a named error when the key is missing", async () => {
  process.env.LLM_PROVIDER = "openrouter";
  process.env.LLM_MODEL = "some/model";
  await assert.rejects(
    () => complete({ system: "s", user: "u", mock: "m" }),
    /LLM_API_KEY/,
  );
});

test("openrouter provider extracts choices[0].message.content", async () => {
  process.env.LLM_PROVIDER = "openrouter";
  process.env.LLM_API_KEY = "sk-or-test";
  process.env.LLM_MODEL = "some/model";
  stubFetch("hello from the model");
  const out = await complete({ system: "s", user: "u", mock: "unused" });
  assert.equal(out, "hello from the model");
});

test("completeJson returns the mock object under the mock provider", async () => {
  process.env.LLM_PROVIDER = "mock";
  const isNum = (v: unknown): v is { n: number } =>
    typeof v === "object" && v !== null && typeof (v as { n?: unknown }).n === "number";
  const out = await completeJson({ system: "s", user: "u", mock: { n: 7 } }, isNum);
  assert.deepEqual(out, { n: 7 });
});

test("completeJson strips code fences before parsing", async () => {
  process.env.LLM_PROVIDER = "openrouter";
  process.env.LLM_API_KEY = "sk-or-test";
  process.env.LLM_MODEL = "some/model";
  stubFetch("```json\n{\"n\":3}\n```");
  const isNum = (v: unknown): v is { n: number } =>
    typeof v === "object" && v !== null && typeof (v as { n?: unknown }).n === "number";
  const out = await completeJson({ system: "s", user: "u", mock: { n: 0 } }, isNum);
  assert.deepEqual(out, { n: 3 });
});

test("completeJson throws when the guard rejects twice", async () => {
  process.env.LLM_PROVIDER = "openrouter";
  process.env.LLM_API_KEY = "sk-or-test";
  process.env.LLM_MODEL = "some/model";
  stubFetch("{\"wrong\":true}");
  const isNum = (v: unknown): v is { n: number } =>
    typeof v === "object" && v !== null && typeof (v as { n?: unknown }).n === "number";
  await assert.rejects(
    () => completeJson({ system: "s", user: "u", mock: { n: 0 } }, isNum),
    /did not match/,
  );
});

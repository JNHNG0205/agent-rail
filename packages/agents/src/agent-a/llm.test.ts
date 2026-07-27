import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { composeBrief, isPosterBrief } from "./llm.js";

beforeEach(() => {
  process.env.LLM_PROVIDER = "mock";
});

test("composeBrief returns a brief with non-empty requirements", async () => {
  const brief = await composeBrief("I need a poster for demo day");
  assert.ok(isPosterBrief(brief));
  assert.ok(brief.requirements.length > 0);
  assert.equal(typeof brief.title, "string");
});

test("isPosterBrief rejects a malformed object", () => {
  assert.equal(isPosterBrief({ title: "t" }), false);
  assert.equal(isPosterBrief(null), false);
  assert.equal(isPosterBrief({ title: 1, subtitle: "", callToAction: "", palette: "", requirements: [] }), false);
});

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

const VALID_BRIEF = {
  title: "Demo Day",
  subtitle: "Autonomous agents",
  callToAction: "Join us",
  palette: "terracotta on cream",
  requirements: ["shows the title"],
};

test("isPosterBrief accepts a fully-valid brief", () => {
  assert.equal(isPosterBrief(VALID_BRIEF), true);
});

test("isPosterBrief rejects an empty requirements array", () => {
  assert.equal(isPosterBrief({ ...VALID_BRIEF, requirements: [] }), false);
});

test("isPosterBrief rejects a non-string requirements entry", () => {
  assert.equal(isPosterBrief({ ...VALID_BRIEF, requirements: [123] }), false);
});

test("isPosterBrief rejects a whitespace-only requirements entry", () => {
  assert.equal(isPosterBrief({ ...VALID_BRIEF, requirements: ["  "] }), false);
});

test("isPosterBrief rejects an empty title", () => {
  assert.equal(isPosterBrief({ ...VALID_BRIEF, title: "" }), false);
});

test("isPosterBrief rejects a whitespace-only title", () => {
  assert.equal(isPosterBrief({ ...VALID_BRIEF, title: "   " }), false);
});

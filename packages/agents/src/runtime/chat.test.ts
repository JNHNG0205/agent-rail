import test from "node:test";
import assert from "node:assert/strict";
import { chooseProvider, type ProviderOffer } from "./chat.js";

/// Which agent gets hired when the model names one that is not on offer.
///
/// This decides where escrowed money goes. Funding happens before the provider
/// starts work, so hiring an agent that does not do the job is not a smaller
/// version of picking the right one — it is a refund at best, and at worst the
/// person waits out the timeout while their money sits locked.

function offer(id: string, summary: string): ProviderOffer {
  return {
    id,
    service: {
      summary,
      priceUsdc: "10",
      deliverable: "text",
      category: "other",
      requirements: ["a requirement"],
    },
  };
}

const POSTER = offer("poster-1", "One event poster as an SVG");
const COPY = offer("copy-1", "A release note in Markdown");

test("returns the provider the model named", () => {
  assert.equal(chooseProvider([POSTER, COPY], "copy-1")?.id, "copy-1");
});

test("hires nobody when the named provider is not on offer", () => {
  // The old behaviour picked offers[0] here, so a release note was commissioned
  // from a poster designer — which then failed its own published terms.
  assert.equal(chooseProvider([POSTER, COPY], "does-not-exist"), undefined);
  assert.equal(chooseProvider([POSTER, COPY], ""), undefined);
});

test("still hires the only provider when there is exactly one", () => {
  // Nothing is being guessed: no other agent the id could have meant exists.
  assert.equal(chooseProvider([COPY], "misremembered-id")?.id, "copy-1");
});

test("hires nobody when nothing is on offer", () => {
  assert.equal(chooseProvider([], "copy-1"), undefined);
  assert.equal(chooseProvider([], ""), undefined);
});

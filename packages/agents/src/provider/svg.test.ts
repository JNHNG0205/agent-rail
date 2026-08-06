import { test } from "node:test";
import assert from "node:assert/strict";
import { isCompleteSvg, isSafeSvg, isAcceptableSvg, unsafeReason, rejectionReason } from "./svg.js";

const GOOD = '<svg viewBox="0 0 600 800" xmlns="http://www.w3.org/2000/svg"><text>Hi</text></svg>';

test("accepts a plain self-contained SVG", () => {
  assert.equal(isAcceptableSvg(GOOD), true);
});

test("rejects a document that stops part-way", () => {
  // The observed failure: the model stops mid-attribute, reporting a normal
  // finish and well under the token limit.
  assert.equal(isCompleteSvg('<svg viewBox="0 0 600 800"><text fill'), false);
});

test("rejects prose", () => {
  assert.equal(isCompleteSvg("Sorry, I can't help with that."), false);
});

test("tolerates surrounding whitespace", () => {
  assert.equal(isCompleteSvg(`\n  ${GOOD}\n`), true);
});

test("rejects an embedded script", () => {
  // The case the previous check let through: outer tags correct, contents not.
  const svg = '<svg><script>fetch("//evil")</script></svg>';
  assert.equal(isCompleteSvg(svg), true, "outer tags are fine, which is the point");
  assert.equal(isSafeSvg(svg), false);
  assert.equal(isAcceptableSvg(svg), false);
});

test("rejects a script tag written with odd spacing or case", () => {
  for (const svg of ['<svg>< script >x</script></svg>', "<svg><ScRiPt>x</ScRiPt></svg>"]) {
    assert.equal(isSafeSvg(svg), false, svg);
  }
});

test("rejects inline event handlers", () => {
  for (const attr of ["onload", "onclick", "onmouseover", "onerror"]) {
    assert.equal(isSafeSvg(`<svg ${attr}="x()"><rect/></svg>`), false, attr);
  }
});

test("rejects foreignObject, which embeds arbitrary HTML", () => {
  assert.equal(isSafeSvg("<svg><foreignObject><body/></foreignObject></svg>"), false);
});

test("rejects an iframe", () => {
  assert.equal(isSafeSvg('<svg><iframe src="//evil"/></svg>'), false);
});

test("rejects a javascript: URL", () => {
  assert.equal(isSafeSvg('<svg><a href="javascript:alert(1)"><rect/></a></svg>'), false);
});

test("rejects an entity declaration", () => {
  // The billion-laughs and local-file-read vector.
  assert.equal(isSafeSvg('<svg><!ENTITY x SYSTEM "file:///etc/passwd"></svg>'), false);
});

test("rejects references to remote resources", () => {
  // A remote reference leaks the viewer's address and makes the deliverable
  // depend on a server nobody in the job controls.
  for (const svg of [
    '<svg><image href="https://evil.test/x.png"/></svg>',
    '<svg><image xlink:href="//evil.test/x.png"/></svg>',
    '<svg><use href="http://evil.test/x#a"/></svg>',
  ]) {
    assert.equal(isSafeSvg(svg), false, svg);
  }
});

test("allows the xmlns declaration, which is not a fetch", () => {
  // xmlns is a namespace name that happens to look like a URL. Rejecting it
  // would reject almost every valid SVG.
  assert.equal(isSafeSvg(GOOD), true);
});

test("allows embedded data URIs", () => {
  // Self-contained, so nothing is fetched.
  const svg = '<svg><image href="data:image/png;base64,iVBORw0KGgo="/></svg>';
  assert.equal(isSafeSvg(svg), true);
});

test("names the specific problem so a retry can fix it", () => {
  assert.match(rejectionReason("<svg><script>x</script></svg>"), /<script>/);
  assert.match(rejectionReason('<svg viewBox="0 0'), /complete SVG document/);
  assert.equal(unsafeReason(GOOD), null);
});

import test from "node:test";
import assert from "node:assert/strict";
import { isAcceptableHtml, isCompleteHtml, unsafeHtmlReason } from "./html.js";

/// What an HTML provider is allowed to deliver.
///
/// The preview frame blocks scripting twice over, but the same bytes can be
/// downloaded and opened from disk, where none of that applies — so the check
/// lives here, on the bytes themselves, before their hash goes on chain.

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Ember</title>
<style>body { background: #FFF6EC; color: #C2410C; }</style></head>
<body><h1>Ember</h1><p>Coffee, slowly.</p></body>
</html>`;

test("accepts a complete self-contained page", () => {
  assert.equal(isAcceptableHtml(PAGE), true);
});

test("accepts a page that starts at <html> with no doctype", () => {
  assert.equal(isCompleteHtml("<html><body>hi</body></html>"), true);
});

test("rejects a document the model stopped writing partway through", () => {
  // The common failure by far: a reply that simply runs out.
  assert.equal(isCompleteHtml('<!DOCTYPE html><html><body><h1 class="t'), false);
  assert.equal(isCompleteHtml("<!DOCTYPE html><html><body>hi</body>"), false);
});

test("rejects prose that is not a page at all", () => {
  assert.equal(isCompleteHtml("Here is your landing page!"), false);
});

test("refuses anything that would execute", () => {
  for (const [markup, expected] of [
    ['<script>alert(1)</script>', "a <script> element"],
    ['<div onclick="steal()">x</div>', "an inline event handler such as onclick"],
    ['<a href="javascript:alert(1)">x</a>', "a javascript: URL"],
    ['<iframe src="/x"></iframe>', "an <iframe> element"],
    ['<object data="x.swf"></object>', "an embedded object"],
  ] as const) {
    const page = PAGE.replace("<h1>Ember</h1>", markup);
    assert.equal(unsafeHtmlReason(page), expected, markup);
  }
});

test("refuses subresources fetched from another server", () => {
  // These leak the viewer's address to a server nobody in the job controls.
  const img = PAGE.replace("<h1>Ember</h1>", '<img src="https://elsewhere.example/a.png">');
  assert.equal(unsafeHtmlReason(img), "a resource loaded from another server");

  const css = PAGE.replace(
    "<title>Ember</title>",
    '<title>Ember</title><link rel="stylesheet" href="https://fonts.example/f.css">',
  );
  assert.equal(unsafeHtmlReason(css), "a stylesheet or font loaded from another server");
});

test("allows a plain link, which only goes anywhere if a person follows it", () => {
  // Refusing these would make most honest pages unacceptable — the reason this
  // is not simply the SVG check, which refuses every remote reference.
  const linked = PAGE.replace("<h1>Ember</h1>", '<a href="https://example.com">Visit</a>');
  assert.equal(unsafeHtmlReason(linked), null);
  assert.equal(isAcceptableHtml(linked), true);
});

/// Whether a model's reply is an HTML document safe to hand on.
///
/// The same two questions asked of an SVG — did the model finish, and would
/// rendering this run something — but the answers differ, so this is not a reuse
/// of svg.ts.
///
/// An SVG is refused for any remote reference at all, including a link. That is
/// right for a drawing, which has no reason to point anywhere. It would be wrong
/// here: a page with no links is barely a page, and refusing them would make
/// most honest deliveries unacceptable. So the line is drawn at subresources —
/// things the browser fetches on its own, which leak the viewer's address to a
/// server nobody in the job controls — while <a href> is left alone, because a
/// link only goes somewhere when a person chooses to follow it.
///
/// Scripting is refused outright. The preview frame already blocks it twice over
/// (sandbox="" and a default-src 'none' policy), but the deliverable can also be
/// downloaded, and a saved page opened from disk runs with none of that.
///
/// Checks, not sanitisers, for the same reason as svg.ts: the hash of exactly
/// these bytes goes on chain and the evaluator grades exactly these bytes.

const DANGEROUS = [
  { pattern: /<\s*script\b/i, what: "a <script> element" },
  { pattern: /<\s*iframe\b/i, what: "an <iframe> element" },
  { pattern: /<\s*(?:object|embed|applet)\b/i, what: "an embedded object" },
  { pattern: /\son\w+\s*=/i, what: "an inline event handler such as onclick" },
  { pattern: /javascript\s*:/i, what: "a javascript: URL" },
  { pattern: /<!ENTITY\b/i, what: "an entity declaration, which can be used to read local files" },
  // Subresources only: src= is always fetched, and so is a stylesheet link.
  // A plain <a href> is deliberately not matched.
  { pattern: /\bsrc\s*=\s*["']?\s*(?:https?:)?\/\//i, what: "a resource loaded from another server" },
  {
    pattern: /<\s*link\b[^>]*\bhref\s*=\s*["']?\s*(?:https?:)?\/\//i,
    what: "a stylesheet or font loaded from another server",
  },
];

/// Models stop mid-document often enough that this is the common failure, not an
/// edge case. A doctype is optional; a closing </html> is what says it finished.
export function isCompleteHtml(value: string): boolean {
  const trimmed = value.trim();
  return /^<(?:!doctype\s+html|html\b)/i.test(trimmed) && /<\/html\s*>$/i.test(trimmed);
}

/// The first dangerous construct found, or null when there is none.
export function unsafeHtmlReason(value: string): string | null {
  for (const { pattern, what } of DANGEROUS) {
    if (pattern.test(value)) return what;
  }
  return null;
}

export function isAcceptableHtml(value: string): boolean {
  return isCompleteHtml(value) && unsafeHtmlReason(value) === null;
}

/// Why a reply was rejected, phrased for the model that has to try again.
export function htmlRejectionReason(value: string): string {
  if (!isCompleteHtml(value)) {
    return "the reply was not a complete HTML document (it must start with <!DOCTYPE html> or <html> and end with </html>)";
  }
  const unsafe = unsafeHtmlReason(value);
  if (unsafe) {
    return `the page contained ${unsafe}; deliver one self-contained page with inline styles, no script and nothing loaded from another server`;
  }
  return "the reply was not acceptable";
}

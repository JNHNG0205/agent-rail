/// Whether a model's reply is an SVG safe to hand on.
///
/// Two different jobs, deliberately separated.
///
/// isCompleteSvg answers "did the model finish?" — the common failure, where a
/// document stops mid-attribute and the reply is simply truncated.
///
/// isSafeSvg answers "would rendering this run something?" SVG is not an image
/// format in the way a PNG is: it carries script, event handlers, external
/// references and embedded HTML, all of which execute in the context of whoever
/// renders it. The content here comes from a model, which took its instructions
/// from a brief written by another party, so treating it as trusted markup would
/// mean a client agent could get script into whatever displays the result.
///
/// Both are checks, not sanitisers. A deliverable that fails is rejected rather
/// than cleaned: the hash goes on chain and the evaluator grades exactly these
/// bytes, so quietly rewriting them would make the three disagree.

/// Anything that can execute, fetch, or navigate when an SVG is rendered.
const DANGEROUS = [
  { pattern: /<\s*script\b/i, what: "a <script> element" },
  { pattern: /<\s*foreignObject\b/i, what: "a <foreignObject> element, which embeds HTML" },
  { pattern: /<\s*iframe\b/i, what: "an <iframe> element" },
  { pattern: /<\s*use\b[^>]*\bhref\s*=\s*["']?\s*(?:https?:)?\/\//i, what: "a <use> referencing a remote document" },
  { pattern: /\son\w+\s*=/i, what: "an inline event handler such as onload" },
  { pattern: /javascript\s*:/i, what: "a javascript: URL" },
  { pattern: /<!ENTITY\b/i, what: "an entity declaration, which can be used to read local files" },
  // Remote references leak the viewer's address to whoever is asked, and make
  // the deliverable depend on a server nobody in the job controls.
  { pattern: /\b(?:xlink:href|href|src)\s*=\s*["']?\s*(?:https?:)?\/\//i, what: "a reference to a remote resource" },
];

export function isCompleteSvg(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("<svg") && trimmed.endsWith("</svg>");
}

/// The first dangerous construct found, or null when there is none.
export function unsafeReason(value: string): string | null {
  for (const { pattern, what } of DANGEROUS) {
    if (pattern.test(value)) return what;
  }
  return null;
}

export function isSafeSvg(value: string): boolean {
  return unsafeReason(value) === null;
}

/// What a provider must produce: finished, and safe to render.
export function isAcceptableSvg(value: string): boolean {
  return isCompleteSvg(value) && isSafeSvg(value);
}

/// Why a reply was rejected, phrased for the model that has to try again.
export function rejectionReason(value: string): string {
  if (!isCompleteSvg(value)) {
    return "the reply was not a complete SVG document (it must start with <svg and end with </svg>)";
  }
  const unsafe = unsafeReason(value);
  if (unsafe) {
    return `the SVG contained ${unsafe}; deliver a self-contained image with no script, no event handlers and no remote references`;
  }
  return "the reply was not acceptable";
}

/// One place that turns a failure into something worth reading. Member 4.
///
/// Everything that can go wrong in this application arrives as a thrown value,
/// and every one of them was being rendered with `err.message`. That is fine for
/// an error somebody wrote — "sign in with the administrator account" — and
/// terrible for the ones a library throws. A rejected signature arrived as nine
/// lines of request arguments, calldata, a decoded function signature, a
/// documentation link and "Version: viem@2.55.5", which pushed the form off the
/// screen and told the reader nothing they could act on.
///
/// So there is a single function, and the rule it follows is: say what happened
/// and what to do about it, in one sentence, or say the caller's fallback.
/// Diagnostics belong in the console, where they are still logged.
///
/// Declining is not a failure. Somebody who closes their wallet has decided
/// something, and reporting that decision back in red as though it were a fault
/// is the interface arguing with the user. `cancelled` marks it so a caller can
/// state it plainly, or say nothing at all.

export interface Described {
  message: string;
  /// The person chose not to proceed. Nothing failed and nothing was spent.
  cancelled: boolean;
}

/// EIP-1193 reports a rejection as 4001, and wallets are far more consistent
/// about the code than about the wording.
function codeOf(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const holder = err as { code?: unknown; cause?: { code?: unknown } };
  const value = typeof holder.code === "number" ? holder.code : holder.cause?.code;
  return typeof value === "number" ? value : undefined;
}

function textOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  // An API route's `{ error: "..." }` handed straight to this.
  if (typeof err === "object" && err !== null) {
    const holder = err as { error?: unknown; message?: unknown };
    if (typeof holder.error === "string") return holder.error;
    if (typeof holder.message === "string") return holder.message;
  }
  return "";
}

const RULES: { match: (raw: string, code?: number) => boolean; message: string; cancelled?: boolean }[] = [
  {
    match: (raw, code) =>
      code === 4001 ||
      raw.includes("user rejected") ||
      raw.includes("user denied") ||
      raw.includes("request rejected"),
    message: "Cancelled. Nothing was charged.",
    cancelled: true,
  },
  {
    match: (raw) => raw.includes("insufficient funds") || raw.includes("exceeds balance"),
    message: "That account does not hold enough to cover it.",
  },
  {
    match: (raw) => raw.includes("chain") && (raw.includes("switch") || raw.includes("mismatch")),
    message: "Your wallet is on a different network. Switch it and try again.",
  },
  {
    match: (raw) =>
      raw.includes("failed to fetch") || raw.includes("networkerror") || raw.includes("econnrefused"),
    message: "Could not reach the server. Check that it is still running.",
  },
  {
    match: (raw) => raw.includes("timeout") || raw.includes("timed out"),
    message: "That took too long to answer. Try again.",
  },
  {
    match: (raw) => raw.includes("nonce too low") || raw.includes("replacement transaction"),
    message: "A transaction from this account is already in flight. Wait for it to settle.",
  },
  {
    match: (raw) => raw.includes("rate limit") || raw.includes("too many requests"),
    message: "The network endpoint is rate limiting. Wait a moment and try again.",
  },
];

/// The longest a message may be before it stops being a sentence and starts
/// being a stack trace. Anything longer falls back to the caller's wording.
const READABLE = 160;

export function describeError(err: unknown, fallback: string): Described {
  // Kept, because the detail is genuinely useful — to a developer, in a console,
  // rather than to a person in a dialog.
  if (err !== undefined && err !== null) console.error("[error]", err);

  const raw = textOf(err);
  const lower = raw.toLowerCase();
  const code = codeOf(err);

  for (const rule of RULES) {
    if (rule.match(lower, code)) {
      return { message: rule.message, cancelled: rule.cancelled ?? false };
    }
  }

  // Otherwise the first sentence only. Libraries put the useful line first and
  // the diagnostics after, so this keeps what somebody might act on and drops
  // the calldata. Messages this application wrote pass through untouched,
  // because they are already one short sentence.
  const first = raw.split(/\n|\. (?=[A-Z])/)[0]?.trim() ?? "";
  const usable = first.length > 0 && first.length <= READABLE ? first : fallback;
  return { message: usable, cancelled: false };
}

/// For the many callers that only want the sentence.
export function errorMessage(err: unknown, fallback: string): string {
  return describeError(err, fallback).message;
}

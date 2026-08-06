import type { IncomingMessage } from "node:http";

/// Who may make the runtime act.
///
/// Reads are open: the directory and each agent's quote are meant to be
/// discoverable, and that is what lets an agent find a counterparty. Writes are
/// not. POST /agents spends the treasury's gas on every call, and
/// POST /agents/:id/hire spends an agent's USDC — unprotected and publicly
/// reachable, the first scanner to find this drains both.
///
/// A shared secret rather than per-user accounts, because the runtime has no
/// notion of a user. The only caller is the web app's server side, which holds
/// the same secret; a browser never reaches this directly.

const HEADER = "authorization";

export function secret(): string | undefined {
  const value = process.env.AGENT_RUNTIME_SECRET;
  return value && value.length > 0 ? value : undefined;
}

/// Bound to loopback unless told otherwise, so the default posture is
/// unreachable rather than open.
export function host(): string {
  return process.env.AGENT_RUNTIME_HOST ?? "127.0.0.1";
}

function isLoopback(h: string): boolean {
  return h === "127.0.0.1" || h === "localhost" || h === "::1";
}

/// Refuse the one genuinely dangerous combination: reachable from anywhere, with
/// nothing checking who is calling. Failing at startup is the point — this is
/// exactly the mistake that is invisible until something is drained.
export function assertSafeToListen(): void {
  if (!isLoopback(host()) && !secret()) {
    throw new Error(
      `refusing to listen on ${host()} without AGENT_RUNTIME_SECRET — ` +
        "anyone reaching this could create agents and spend the treasury",
    );
  }
}

/// Constant-time comparison, so a wrong secret cannot be found byte by byte from
/// how long the answer takes.
function matches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export function isAuthorised(req: IncomingMessage): boolean {
  const expected = secret();
  // No secret configured means loopback-only (assertSafeToListen guarantees it),
  // so local development needs no ceremony.
  if (!expected) return true;

  const header = req.headers[HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return false;

  const token = value.startsWith("Bearer ") ? value.slice(7) : value;
  return matches(token, expected);
}

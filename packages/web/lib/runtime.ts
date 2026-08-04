/// The agent runtime, reached from server-side API routes only.
///
/// The browser never calls it directly. Going through this app keeps everything
/// same-origin — no CORS, and the runtime's address stays server-side, so it
/// need not be exposed on a public interface to be usable.
const RUNTIME_URL = process.env.AGENT_RUNTIME_URL ?? "http://127.0.0.1:4030";

export interface ProxyResult {
  status: number;
  body: unknown;
}

/// Forward a request and return whatever came back.
///
/// The runtime's status codes are meaningful — 402 is a price, 404 is an unknown
/// agent — so they are passed through rather than collapsed into 200 or 500.
export async function proxy(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<ProxyResult> {
  try {
    const res = await fetch(`${RUNTIME_URL}${path}`, {
      method: init?.method ?? "GET",
      headers: init?.body ? { "content-type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    return { status: res.status, body: await res.json() };
  } catch {
    // A refused connection means the runtime is not running, which is a
    // different problem from a request it rejected — say so.
    return {
      status: 503,
      body: { error: `the agent runtime is not reachable at ${RUNTIME_URL}` },
    };
  }
}

export { RUNTIME_URL };

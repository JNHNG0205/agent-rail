import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

/// The proxy is the only thing that holds the runtime's secret, and the only
/// reason these routes exist rather than the page calling the runtime directly.
/// Two properties matter: the secret goes out, and it never comes back.

const realFetch = globalThis.fetch;

interface Capture {
  url: string;
  init: RequestInit | undefined;
}

function stubFetch(capture: Capture[], response: { status: number; body: unknown } | Error) {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    capture.push({ url: String(url), init });
    if (response instanceof Error) throw response;
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

// A plain import, because the module reads its configuration per call rather
// than at load — which is what lets these tests change it between cases.
async function loadProxy() {
  return import("./runtime.js");
}

beforeEach(() => {
  delete process.env.AGENT_RUNTIME_SECRET;
  process.env.AGENT_RUNTIME_URL = "http://runtime.test";
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("forwards to the configured runtime", async () => {
  const calls: Capture[] = [];
  stubFetch(calls, { status: 200, body: [] });
  const { proxy } = await loadProxy();

  await proxy("/agents");

  assert.equal(calls[0]?.url, "http://runtime.test/agents");
});

test("passes the runtime's status through unchanged", async () => {
  // 402 is a price and 404 is an unknown agent. Collapsing them into 200 or 500
  // would throw away what the runtime was saying.
  for (const status of [200, 400, 401, 402, 404]) {
    const calls: Capture[] = [];
    stubFetch(calls, { status, body: { ok: status } });
    const { proxy } = await loadProxy();

    const result = await proxy("/agents/x/task");
    assert.equal(result.status, status);
  }
});

test("sends the secret when one is configured", async () => {
  process.env.AGENT_RUNTIME_SECRET = "s3cret";
  const calls: Capture[] = [];
  stubFetch(calls, { status: 201, body: {} });
  const { proxy } = await loadProxy();

  await proxy("/agents", { method: "POST", body: { name: "x" } });

  const headers = calls[0]?.init?.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer s3cret");
});

test("sends no authorization header when no secret is configured", async () => {
  const calls: Capture[] = [];
  stubFetch(calls, { status: 200, body: [] });
  const { proxy } = await loadProxy();

  await proxy("/agents");

  const headers = (calls[0]?.init?.headers ?? {}) as Record<string, string>;
  assert.equal(headers.authorization, undefined);
});

test("sets a JSON content type only when there is a body", async () => {
  process.env.AGENT_RUNTIME_SECRET = "s3cret";
  const calls: Capture[] = [];
  stubFetch(calls, { status: 200, body: {} });
  const { proxy } = await loadProxy();

  await proxy("/agents");
  await proxy("/agents", { method: "POST", body: { a: 1 } });

  assert.equal((calls[0]?.init?.headers as Record<string, string>)["content-type"], undefined);
  assert.equal((calls[1]?.init?.headers as Record<string, string>)["content-type"], "application/json");
});

test("reports a 503 when the runtime is unreachable", async () => {
  // A refused connection means the runtime is not running, which is a different
  // problem from a request it rejected — and the message has to say which.
  const calls: Capture[] = [];
  stubFetch(calls, new Error("ECONNREFUSED"));
  const { proxy } = await loadProxy();

  const result = await proxy("/agents");

  assert.equal(result.status, 503);
  assert.match(String((result.body as { error: string }).error), /not reachable/);
});

test("never returns the secret to the caller", async () => {
  // This response crosses into the browser. The secret is server-side only, and
  // the whole reason for proxying rather than calling the runtime from the page.
  process.env.AGENT_RUNTIME_SECRET = "s3cret";
  const calls: Capture[] = [];
  stubFetch(calls, { status: 200, body: { agents: [] } });
  const { proxy } = await loadProxy();

  const result = await proxy("/agents");

  assert.equal(JSON.stringify(result).includes("s3cret"), false);
});

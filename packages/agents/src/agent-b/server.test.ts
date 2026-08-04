import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { startServer, rememberDeliverable, SERVICE_REQUIREMENTS } from "./server.js";

let server: Server;
let baseUrl: string;

const originalPort = process.env.AGENT_B_PORT;
const originalPrivateKey = process.env.AGENT_B_PRIVATE_KEY;

before(async () => {
  process.env.AGENT_B_PORT = "0";
  process.env.AGENT_B_PRIVATE_KEY =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

  server = await startServer();
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;

  rememberDeliverable(1n, "<svg/>");
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

  if (originalPort === undefined) delete process.env.AGENT_B_PORT;
  else process.env.AGENT_B_PORT = originalPort;

  if (originalPrivateKey === undefined) delete process.env.AGENT_B_PRIVATE_KEY;
  else process.env.AGENT_B_PRIVATE_KEY = originalPrivateKey;
});

test("GET /task returns a 402 quote", async () => {
  const res = await fetch(`${baseUrl}/task`);
  assert.equal(res.status, 402);
  assert.equal(res.headers.get("content-type"), "application/json");
  const body = await res.json();
  assert.deepEqual(body.requirements, SERVICE_REQUIREMENTS);
});

test("GET /task?foo=bar still returns 402", async () => {
  const res = await fetch(`${baseUrl}/task?foo=bar`);
  assert.equal(res.status, 402);
  assert.equal(res.headers.get("content-type"), "application/json");
  const body = await res.json();
  assert.deepEqual(body.requirements, SERVICE_REQUIREMENTS);
});

test("GET /deliverable/:jobId returns the stored SVG", async () => {
  const res = await fetch(`${baseUrl}/deliverable/1`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/svg+xml");
  assert.equal(await res.text(), "<svg/>");
});

test("GET /deliverable/:jobId?cachebust=9 still returns the stored SVG", async () => {
  const res = await fetch(`${baseUrl}/deliverable/1?cachebust=9`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/svg+xml");
  assert.equal(await res.text(), "<svg/>");
});

test("GET /deliverable/:jobId returns 404 when nothing is stored", async () => {
  const res = await fetch(`${baseUrl}/deliverable/999`);
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("content-type"), "application/json");
  const body = await res.json();
  assert.ok(typeof body.error === "string");
});

test("GET /nope returns 404", async () => {
  const res = await fetch(`${baseUrl}/nope`);
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("content-type"), "application/json");
  const body = await res.json();
  assert.ok(typeof body.error === "string");
});

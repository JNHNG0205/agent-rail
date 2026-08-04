import { createServer, type Server, type IncomingMessage } from "node:http";
import type { PosterBrief } from "@agentrail/shared";
import { addresses } from "@agentrail/shared";
import {
  listAgents,
  getAgent,
  createAgent,
  toPublic,
  type ServiceOffer,
} from "./store.js";
import { onboard, describe } from "../lib/onboard.js";
import { hire, findProviders } from "./hire.js";
import { chat, isChatHistory } from "./chat.js";
import { isAuthorised, assertSafeToListen, host, secret } from "./auth.js";
import { accountOf } from "./store.js";

/// The agent runtime's HTTP surface.
///
/// A browser cannot spawn a process, so one service hosts every agent a user
/// creates. Each gets its own paths under /agents/:id, which is what lets one
/// agent hire another by URL without anything being hardcoded.
///
///   POST /agents                       create one
///   GET  /agents                       the directory — who exists, what they sell
///   GET  /agents/:id/task              that agent's 402 quote
///   POST /agents/:id/commission        hand it a brief
///   GET  /agents/:id/commission/:jobId
///   GET  /agents/:id/deliverable/:jobId

/// Work in flight, keyed by "agentId:jobId" so two agents cannot collide on a
/// job number. In memory only: the chain holds the authoritative deliverable
/// hash, and a restart losing the content is recoverable through the timeout.
const commissions = new Map<string, PosterBrief>();
const deliverables = new Map<string, string>();

const workKey = (agentId: string, jobId: bigint) => `${agentId}:${jobId}`;

export function rememberCommission(agentId: string, jobId: bigint, brief: PosterBrief): void {
  commissions.set(workKey(agentId, jobId), brief);
}
export function getCommission(agentId: string, jobId: bigint): PosterBrief | undefined {
  return commissions.get(workKey(agentId, jobId));
}
export function rememberDeliverable(agentId: string, jobId: bigint, svg: string): void {
  deliverables.set(workKey(agentId, jobId), svg);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      // Cap it: an agent's brief is small, and an unbounded read is a way to
      // exhaust this process's memory from outside.
      if (body.length > 100_000) reject(new Error("body too large"));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function isPosterBrief(value: unknown): value is PosterBrief {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.title === "string" &&
    typeof v.subtitle === "string" &&
    typeof v.callToAction === "string" &&
    typeof v.palette === "string" &&
    Array.isArray(v.requirements) &&
    v.requirements.every((r) => typeof r === "string")
  );
}

function isServiceOffer(value: unknown): value is ServiceOffer {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.summary === "string" &&
    v.summary.length > 0 &&
    typeof v.priceUsdc === "string" &&
    /^\d+(\.\d+)?$/.test(v.priceUsdc) &&
    Array.isArray(v.requirements) &&
    v.requirements.length > 0 &&
    v.requirements.every((r) => typeof r === "string")
  );
}

/// Treasury that funds a new agent's first operation. A smart account cannot pay
/// for its own deployment, so something outside it has to go first.
///
/// Deliberately not the deployer. That key owns JobContract and
/// ReputationRegistry, and an owner can re-point the identity registry and the
/// evaluator module — handing it to a service that accepts requests from a
/// browser would undo the separation the deployer exists to create. The treasury
/// holds testnet ETH and no authority at all.
function treasuryKey(): `0x${string}` | undefined {
  return process.env.BASE_SEPOLIA_TREASURY_PRIVATE_KEY as `0x${string}` | undefined;
}

export function startRuntime(): Promise<Server> {
  const port = Number(process.env.AGENT_RUNTIME_PORT ?? 4030);

  const server = createServer(async (req, res) => {
    const url = (req.url ?? "").split("?")[0] ?? "";
    const parts = url.split("/").filter(Boolean);
    const method = req.method ?? "GET";

    const json = (status: number, body: unknown) => {
      res.writeHead(status, {
        "content-type": "application/json",
        // The browser calls this directly during a demo, from :3000.
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "content-type",
      });
      res.end(JSON.stringify(body));
    };

    if (method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      res.end();
      return;
    }

    // Reads stay open — the directory and each quote exist to be discovered.
    // Writes spend gas, USDC and model tokens, so they are gated.
    if (method !== "GET" && !isAuthorised(req)) {
      json(401, { error: "unauthorised" });
      return;
    }

    try {
      // GET /agents — the directory. This is discovery: an agent reads it to
      // find who sells what, rather than having a counterparty compiled in.
      if (method === "GET" && parts.length === 1 && parts[0] === "agents") {
        json(200, (await listAgents()).map(toPublic));
        return;
      }

      // POST /agents — create one, then bring it on chain.
      if (method === "POST" && parts.length === 1 && parts[0] === "agents") {
        const body: unknown = JSON.parse(await readBody(req));
        const b = body as { name?: unknown; role?: unknown; service?: unknown };

        if (typeof b.name !== "string" || b.name.trim().length === 0 || b.name.length > 60) {
          json(400, { error: "name must be a non-empty string of at most 60 characters" });
          return;
        }
        if (b.role !== "client" && b.role !== "provider") {
          json(400, { error: 'role must be "client" or "provider"' });
          return;
        }
        if (b.role === "provider" && !isServiceOffer(b.service)) {
          json(400, {
            error: "a provider needs service {summary, priceUsdc, requirements[]}",
          });
          return;
        }

        const record = await createAgent({
          name: b.name.trim(),
          role: b.role,
          service: b.role === "provider" ? (b.service as ServiceOffer) : null,
        });

        // Fund, register, and grant a client its spending money. Done here so
        // the agent is usable the moment this call returns.
        const account = await accountOf(record);
        await onboard(account, {
          treasuryKey: treasuryKey(),
          grantUsdc: record.role === "client",
        });

        console.log(`[runtime] created ${record.role} "${record.name}" (${record.id})`);
        console.log(`[runtime]   ${await describe(account)}`);
        json(201, toPublic(record));
        return;
      }

      // POST /agents/:id/chat — talk to your agent until it has a brief.
      if (method === "POST" && parts.length === 3 && parts[0] === "agents" && parts[2] === "chat") {
        const agent = await getAgent(parts[1]!);
        if (!agent) {
          json(404, { error: `no agent "${parts[1]}"` });
          return;
        }
        const body: unknown = JSON.parse(await readBody(req));
        const history = (body as { messages?: unknown }).messages;
        if (!isChatHistory(history)) {
          json(400, {
            error: "messages must be a non-empty array of {role, content}, at most 40",
          });
          return;
        }

        // The agent is told what is actually on offer, so it can only promise
        // work someone is selling.
        const candidates = await findProviders(agent.id);
        const reply = await chat({
          agent,
          history,
          offers: candidates.map((p) => p.service!),
          requirements: candidates[0]?.service?.requirements ?? [],
        });
        json(200, reply);
        return;
      }

      // POST /agents/:id/hire — this agent finds a provider and commissions it.
      if (method === "POST" && parts.length === 3 && parts[0] === "agents" && parts[2] === "hire") {
        const client = await getAgent(parts[1]!);
        if (!client) {
          json(404, { error: `no agent "${parts[1]}"` });
          return;
        }
        const body: unknown = JSON.parse(await readBody(req));
        const b = body as { brief?: unknown; providerId?: unknown };
        if (!isPosterBrief(b.brief)) {
          json(400, { error: "brief is malformed" });
          return;
        }

        // Pick from the directory when the caller does not name one — the agent
        // choosing its own counterparty is the point.
        const candidates = await findProviders(client.id);
        const chosen =
          typeof b.providerId === "string"
            ? candidates.find((p) => p.id === b.providerId)
            : candidates[0];
        if (!chosen) {
          json(400, { error: "no provider is offering a service" });
          return;
        }

        const evaluator = process.env.BASE_SEPOLIA_EVALUATOR_ADDRESS ?? process.env.EVALUATOR_ADDRESS;
        if (!evaluator) {
          json(500, { error: "no evaluator address configured" });
          return;
        }

        const result = await hire({
          clientId: client.id,
          providerId: chosen.id,
          evaluator: evaluator as `0x${string}`,
          brief: b.brief,
        });
        json(200, {
          jobId: result.jobId.toString(),
          provider: toPublic(result.provider),
          amount: result.amount.toString(),
        });
        return;
      }

      // Everything below addresses one agent.
      if (parts[0] !== "agents" || parts.length < 3) {
        json(404, { error: "not found" });
        return;
      }
      const agent = await getAgent(parts[1]!);
      if (!agent) {
        json(404, { error: `no agent "${parts[1]}"` });
        return;
      }

      // GET /agents/:id/task — the 402 quote, in that agent's own terms.
      if (method === "GET" && parts[2] === "task" && parts.length === 3) {
        if (agent.role !== "provider" || !agent.service) {
          json(400, { error: `"${agent.name}" is a client and sells nothing` });
          return;
        }
        json(402, {
          price: (BigInt(Math.round(Number(agent.service.priceUsdc) * 1e6))).toString(),
          provider: agent.address,
          contract: addresses.JobContract,
          service: agent.service.summary,
          description: agent.service.summary,
          requirements: agent.service.requirements,
        });
        return;
      }

      // POST /agents/:id/commission — the work order that JobFunded cannot carry.
      if (method === "POST" && parts[2] === "commission" && parts.length === 3) {
        const body: unknown = JSON.parse(await readBody(req));
        const b = body as { jobId?: unknown; brief?: unknown };
        if (typeof b.jobId !== "string" || !/^\d+$/.test(b.jobId)) {
          json(400, { error: "jobId must be a decimal string" });
          return;
        }
        if (!isPosterBrief(b.brief)) {
          json(400, { error: "brief is malformed" });
          return;
        }
        rememberCommission(agent.id, BigInt(b.jobId), b.brief);
        console.log(`[runtime] ${agent.name}: commissioned for job ${b.jobId}`);
        json(200, { ok: true });
        return;
      }

      // GET /agents/:id/commission/:jobId — the evaluator reads the brief here.
      if (method === "GET" && parts[2] === "commission" && parts.length === 4) {
        const brief = getCommission(agent.id, BigInt(parts[3]!));
        if (!brief) {
          json(404, { error: `no commission for job ${parts[3]}` });
          return;
        }
        json(200, brief);
        return;
      }

      // GET /agents/:id/deliverable/:jobId — the work itself.
      if (method === "GET" && parts[2] === "deliverable" && parts.length === 4) {
        const svg = deliverables.get(workKey(agent.id, BigInt(parts[3]!)));
        if (!svg) {
          json(404, { error: `no deliverable for job ${parts[3]}` });
          return;
        }
        res.writeHead(200, {
          "content-type": "image/svg+xml",
          "access-control-allow-origin": "*",
        });
        res.end(svg);
        return;
      }

      json(404, { error: "not found" });
    } catch (err) {
      console.error("[runtime]", err);
      json(500, { error: err instanceof Error ? err.message : "internal error" });
    }
  });

  assertSafeToListen();

  return new Promise((resolve) => {
    server.listen(port, host(), () => {
      const guard = secret() ? "secret required for writes" : "loopback only, no secret set";
      console.log(`[runtime] agent runtime on ${host()}:${port} (${guard})`);
      resolve(server);
    });
  });
}

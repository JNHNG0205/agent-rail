import { createServer, type Server } from "node:http";
import { addresses, type PosterBrief } from "@agentrail/shared";
import { agentB } from "../lib/wallet.js";

/// The fixed service Agent B sells. Advertised in the 402 quote and adopted by
/// Agent A into the brief, so the terms Agent C grades against are the same
/// array Agent B published — they cannot drift apart.
export const SERVICE_REQUIREMENTS = [
  "shows the title text",
  "shows the subtitle text",
  "shows the call to action",
  "uses the requested palette",
];

// jobId -> work order / result. In-memory only: a restart loses these, which is
// acceptable because the chain holds the authoritative deliverable hash. The
// brief has to live off-chain somewhere because JobFunded carries only
// (jobId, amount) — Agent B could not otherwise know what to produce, nor
// Agent C what to grade it against.
const commissions = new Map<string, PosterBrief>();
const deliverables = new Map<string, string>();

export function rememberCommission(jobId: bigint, brief: PosterBrief): void {
  commissions.set(jobId.toString(), brief);
}

export function getCommission(jobId: bigint): PosterBrief | undefined {
  return commissions.get(jobId.toString());
}

export function rememberDeliverable(jobId: bigint, svg: string): void {
  deliverables.set(jobId.toString(), svg);
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      // A brief is a few hundred bytes; anything larger is not a brief.
      if (body.length > 64_000) reject(new Error("body too large"));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function isPosterBriefShape(value: unknown): value is PosterBrief {
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

export async function startServer(): Promise<Server> {
  const port = Number(process.env.AGENT_B_PORT ?? 4020);
  const priceUsdc = process.env.AGENT_B_PRICE_USDC ?? "10";
  const provider = await agentB();

  const server = createServer(async (req, res) => {
    const path = (req.url ?? "").split("?")[0] ?? "";
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    // The 402 quote. No real x402 negotiation per the proposal scope — the
    // price and terms are fixed and the client either funds a job or does not.
    if (req.method === "GET" && path === "/task") {
      json(402, {
        price: (BigInt(priceUsdc) * 10n ** 6n).toString(),
        provider: provider.address,
        contract: addresses.JobContract,
        service: "poster-design",
        description: "One poster delivered as a self-contained SVG document.",
        requirements: SERVICE_REQUIREMENTS,
      });
      return;
    }

    // Work order. Agent A posts the brief after createJob, because the jobId
    // is what keys it, and before fundJob, so the brief is already here when
    // JobFunded fires.
    if (req.method === "POST" && path === "/commission") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await readBody(req));
      } catch {
        json(400, { error: "invalid JSON body" });
        return;
      }
      const { jobId, brief } = (parsed ?? {}) as { jobId?: unknown; brief?: unknown };
      if (typeof jobId !== "string" || !/^\d+$/.test(jobId)) {
        json(400, { error: "jobId must be a decimal string" });
        return;
      }
      if (!isPosterBriefShape(brief)) {
        json(400, { error: "brief does not match PosterBrief" });
        return;
      }
      rememberCommission(BigInt(jobId), brief);
      console.log(`[agent-b] commission accepted for job ${jobId}: ${brief.title}`);
      json(202, { accepted: true, jobId });
      return;
    }

    const commissionMatch = /^\/commission\/(\d+)$/.exec(path);
    if (req.method === "GET" && commissionMatch) {
      const brief = commissions.get(commissionMatch[1]!);
      if (!brief) {
        json(404, { error: "no commission for that job" });
        return;
      }
      json(200, brief);
      return;
    }

    const deliverableMatch = /^\/deliverable\/(\d+)$/.exec(path);
    if (req.method === "GET" && deliverableMatch) {
      const svg = deliverables.get(deliverableMatch[1]!);
      if (!svg) {
        json(404, { error: "no deliverable for that job" });
        return;
      }
      // Served as image/svg+xml so the web UI can render it directly.
      res.writeHead(200, { "content-type": "image/svg+xml" });
      res.end(svg);
      return;
    }

    json(404, { error: "not found" });
  });

  server.listen(port, () => console.log(`[agent-b] 402 server on :${port}`));
  return server;
}

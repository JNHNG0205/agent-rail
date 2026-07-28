import { createServer, type Server } from "node:http";
import { addresses } from "@agentrail/shared";
import { agentB } from "../lib/wallet.js";

/// The fixed service Agent B sells. Advertised in the 402 quote and used verbatim as the
/// rubric by the evaluator, so advertised and graded terms cannot drift apart.
export const SERVICE_REQUIREMENTS = [
  "shows the title text",
  "shows the subtitle text",
  "shows the call to action",
  "uses the requested palette",
];

// jobId -> SVG. In-memory only; a restart loses deliverables, which is acceptable for a
// demo where the chain holds the authoritative hash.
const deliverables = new Map<string, string>();

export function rememberDeliverable(jobId: bigint, svg: string): void {
  deliverables.set(jobId.toString(), svg);
}

export function startServer(): Server {
  const port = Number(process.env.AGENT_B_PORT ?? 4020);
  const priceUsdc = process.env.AGENT_B_PRICE_USDC ?? "10";
  const { account } = agentB();

  const server = createServer((req, res) => {
    const path = (req.url ?? "").split("?")[0] ?? "";

    if (req.method === "GET" && path === "/task") {
      const quote = {
        price: (BigInt(priceUsdc) * 10n ** 6n).toString(),
        provider: account.address,
        contract: addresses.JobContract,
        service: "poster-design",
        description: "One poster delivered as a self-contained SVG document.",
        requirements: SERVICE_REQUIREMENTS,
      };
      res.writeHead(402, { "content-type": "application/json" });
      res.end(JSON.stringify(quote));
      return;
    }

    const match = /^\/deliverable\/(\d+)$/.exec(path);
    if (req.method === "GET" && match) {
      const svg = deliverables.get(match[1]!);
      if (!svg) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "no deliverable for that job" }));
        return;
      }
      res.writeHead(200, { "content-type": "image/svg+xml" });
      res.end(svg);
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(port, () => console.log(`[agent-b] 402 server on :${port}`));
  return server;
}

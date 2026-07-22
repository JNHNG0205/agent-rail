import { createServer, type Server } from "node:http";
import { addresses } from "@agentrail/shared";
import { agentB } from "../lib/wallet.js";

/// Agent B's HTTP endpoint. Per the proposal scope there is no real x402
/// negotiation — GET /task returns a hardcoded 402 Payment Required with a
/// quote the client reads to fund an on-chain job. Member 4.
export function startServer(): Server {
  const port = Number(process.env.AGENT_B_PORT ?? 4020);
  const priceUsdc = process.env.AGENT_B_PRICE_USDC ?? "10";
  const { account } = agentB();

  const server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/task") {
      const quote = {
        price: (BigInt(priceUsdc) * 10n ** 6n).toString(), // USDC minor units
        provider: account.address,
        contract: addresses.JobContract,
        description: "Hardcoded 402 quote for the demo task.",
      };
      res.writeHead(402, { "content-type": "application/json" });
      res.end(JSON.stringify(quote));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(port, () => console.log(`[agent-b] 402 server on :${port}`));
  return server;
}

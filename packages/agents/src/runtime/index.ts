import "dotenv/config";
import { startRuntime } from "./server.js";
import { startProviderWorker } from "./worker.js";
import { listAgents } from "./store.js";

/// Agent runtime: hosts every agent a user creates, and works their jobs.
///
/// Agent C is not hosted here. It is the fixed evaluator and runs separately —
/// a referee that a party to the trade could create would be no referee at all.
async function main() {
  const server = await startRuntime();

  const existing = listAgents();
  if (existing.length === 0) {
    console.log("[runtime] no agents yet — POST /agents to create one");
  } else {
    for (const a of existing) {
      console.log(`[runtime] hosting ${a.role} "${a.name}" (${a.id}) at ${a.address}`);
    }
  }

  const unwatch = startProviderWorker();

  const shutdown = () => {
    unwatch();
    server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[runtime] failed to start:", err instanceof Error ? err.message : err);
  process.exit(1);
});

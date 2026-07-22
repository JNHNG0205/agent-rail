import "dotenv/config";
import { startServer } from "./server.js";
import { startWorker } from "./worker.js";

/// Agent B (provider) entry point: serve the 402 HTTP endpoint AND listen for
/// funded jobs on-chain. Member 4.
function main() {
  const server = startServer();
  const unwatch = startWorker();

  const shutdown = () => {
    unwatch();
    server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();

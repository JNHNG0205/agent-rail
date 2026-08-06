import "dotenv/config";
import { startRuntime } from "./server.js";
import { startProviderWorker } from "./worker.js";
import { listAgents, importLegacyFile, createAgent, accountOf } from "./store.js";
import { onboard, describe } from "../lib/onboard.js";
import { claimOverdue } from "./claim.js";

/// Every user talks to a client agent, and nobody should have to create one
/// before they can say anything. So the runtime provisions it at startup rather
/// than lazily: funding and registering takes about ten seconds on a public
/// chain, and doing it on the first message would hang that message.
///
/// One shared assistant, because the runtime has no notion of a user. Per-user
/// assistants need an ownership model, which is deliberately not built.
const DEFAULT_CLIENT_NAME = "Your Assistant";

async function ensureDefaultClient(): Promise<void> {
  const existing = await listAgents();
  if (existing.some((a) => a.role === "client")) return;

  console.log(`[runtime] no client agent yet — creating "${DEFAULT_CLIENT_NAME}"…`);
  const record = await createAgent({ name: DEFAULT_CLIENT_NAME, role: "client" });
  const account = await accountOf(record);
  await onboard(account, {
    treasuryKey: process.env.BASE_SEPOLIA_TREASURY_PRIVATE_KEY as `0x${string}` | undefined,
    grantUsdc: true,
  });
  console.log(`[runtime]   ${await describe(account)}`);
}

/// Agent runtime: hosts every agent a user creates, and works their jobs.
///
/// Agent C is not hosted here. It is the fixed evaluator and runs separately —
/// a referee that a party to the trade could create would be no referee at all.
async function main() {
  // Bring across anything the file-based store held. Those agents hold
  // registered on-chain identities, and a soulbound token cannot be re-minted —
  // dropping their keys would orphan them permanently.
  const imported = await importLegacyFile();
  if (imported > 0) console.log(`[runtime] imported ${imported} agent(s) from the legacy file`);

  await ensureDefaultClient();

  const server = await startRuntime();

  const existing = await listAgents();
  if (existing.length === 0) {
    console.log("[runtime] no agents yet — POST /agents to create one");
  } else {
    for (const a of existing) {
      console.log(`[runtime] hosting ${a.role} "${a.name}" (${a.id}) at ${a.address}`);
    }
  }

  // Collect for delivered work the evaluator never ruled on. The contract's
  // remedy for a silent evaluator only exists if something exercises it.
  try {
    const claimed = await claimOverdue();
    if (claimed.length === 0) console.log("[runtime] nothing overdue to claim");
  } catch (err) {
    // Never let a cleanup pass stop the runtime from serving.
    console.error("[runtime] timeout claim pass failed:", err instanceof Error ? err.message : err);
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

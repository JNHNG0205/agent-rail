import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { createPublicClient, http, formatEther, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import {
  getAddresses,
  isDeployed,
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_RPC_URL,
  IdentityRegistryAbi,
  MockUSDCAbi,
  agentLabel,
} from "@agentrail/shared";

/// Check that Base Sepolia is ready to run a demo, before anything starts.
///
/// Unlike the local chain, testnet state is not rebuilt on each run — the
/// contracts, the registrations and the gas all have to already be right. Every
/// way that can be wrong fails deep inside an agent with a message about
/// something else: an unregistered party surfaces as NotRegistered from
/// createJob, an unfunded agent as an opaque RPC rejection, a missing deployment
/// as a call to the zero address returning nothing. Checking up front turns all
/// of those into one sentence naming what to fix.

// Also read the agents' own file. Every other consumer reads exactly one env
// file, and that rule is what stops a value being set where nothing looks for
// it — but this script checks readiness rather than consuming configuration,
// and the treasury it must verify legitimately lives with the agents that use
// it. Read second and without override, so the root file still wins.
loadEnv({ path: "packages/agents/.env" });

const MIN_GAS = 2_000_000_000_000_000n; // 0.002 ETH — a few dozen transactions.

/// Only the evaluator is required. Agents A and B are seeds from the two-agent
/// design that preceded the marketplace: users create their own agents now, and
/// the runtime funds and registers each one as it goes. Demanding all three made
/// setting this up a matter of three faucet claims instead of one, for two
/// accounts that nothing then uses.
///
/// They are still checked when present, because a half-configured seed is worth
/// reporting — just not worth refusing to start over.
const AGENTS = [
  { role: "C", env: "BASE_SEPOLIA_AGENT_C_PRIVATE_KEY", required: true },
  { role: "A", env: "BASE_SEPOLIA_AGENT_A_PRIVATE_KEY", required: false },
  { role: "B", env: "BASE_SEPOLIA_AGENT_B_PRIVATE_KEY", required: false },
] as const;

const problems: string[] = [];

async function main() {
  const rpc = process.env.BASE_SEPOLIA_RPC_URL ?? BASE_SEPOLIA_RPC_URL;
  const usingPublic = rpc === BASE_SEPOLIA_RPC_URL;

  console.log(`[preflight] Base Sepolia via ${new URL(rpc).host}`);
  if (usingPublic) {
    // Not fatal — it works, slowly. Worth saying out loud, because the failure
    // it eventually causes (a stalled backfill) looks like a hang, not a limit.
    console.log(
      "[preflight] warning: public endpoint. The indexer's historical backfill will rate-limit;",
    );
    console.log(
      "[preflight]          set BASE_SEPOLIA_RPC_URL to a private endpoint for a smooth run.",
    );
  }

  if (!isDeployed(BASE_SEPOLIA_CHAIN_ID)) {
    console.error("[preflight] no deployment recorded for Base Sepolia.");
    console.error("[preflight] run: npm run deploy:base-sepolia && npm run seed:base-sepolia");
    process.exit(1);
  }

  const addresses = getAddresses(BASE_SEPOLIA_CHAIN_ID);
  const client = createPublicClient({ chain: baseSepolia, transport: http(rpc) });

  // A recorded address with no code is worse than none: every call returns empty
  // and the agents fail one layer down, describing a decode error.
  for (const [name, address] of Object.entries(addresses)) {
    const code = await client.getCode({ address: address as `0x${string}` });
    if (!code || code === "0x") {
      problems.push(`${name} has no contract code at ${address} — redeploy`);
    }
  }

  for (const { role, env, required } of AGENTS) {
    const key = process.env[env];
    if (!key) {
      if (required) problems.push(`${env} is not set — the evaluator cannot sign without it`);
      continue;
    }
    const account = privateKeyToAccount(key as `0x${string}`);
    const label = agentLabel(account.address);

    const [balance, registered, usdc] = await Promise.all([
      client.getBalance({ address: account.address }),
      client.readContract({
        address: addresses.IdentityRegistry,
        abi: IdentityRegistryAbi,
        functionName: "isRegistered",
        args: [account.address],
      }),
      client.readContract({
        address: addresses.MockUSDC,
        abi: MockUSDCAbi,
        functionName: "balanceOf",
        args: [account.address],
      }),
    ]);

    const gas = `${Number(formatEther(balance)).toFixed(4)} ETH`;
    const held = `${formatUnits(usdc as bigint, 6)} USDC`;
    console.log(`[preflight] ${label.padEnd(20)} ${gas.padEnd(12)} ${held.padEnd(14)} registered=${registered}`);

    if (!registered && required) {
      problems.push(`agent ${role} (${account.address}) is not registered — run npm run seed:base-sepolia`);
    }
    if (balance < MIN_GAS && required) {
      problems.push(`agent ${role} (${account.address}) has only ${gas} — fund it from a faucet`);
    }
    // Only a client ever spends USDC, so an empty provider or evaluator is fine.
    // A seeded client with none is worth saying, without being fatal — nothing
    // in the marketplace depends on it.
    if (role === "A" && (usdc as bigint) === 0n) {
      console.log("[preflight] note: seed agent A holds no USDC (harmless — users create their own agents)");
    }
  }

  // The treasury pays every new agent's first gas. Nothing checked it, and an
  // empty one fails at agent creation with a bundler error about a sender
  // balance — which reads as a code fault rather than an empty wallet.
  const treasuryKey = process.env.BASE_SEPOLIA_TREASURY_PRIVATE_KEY;
  if (!treasuryKey) {
    problems.push(
      "BASE_SEPOLIA_TREASURY_PRIVATE_KEY is not set — no new agent could be funded",
    );
  } else {
    const treasury = privateKeyToAccount(treasuryKey as `0x${string}`);
    const balance = await client.getBalance({ address: treasury.address });
    const perAgent = 4_000_000_000_000_000n; // 0.004 ETH, what onboarding sends
    console.log(
      `[preflight] Treasury${" ".repeat(13)}${Number(formatEther(balance)).toFixed(4)} ETH   funds ${balance / perAgent} more agent(s)`,
    );
    if (balance < perAgent) {
      problems.push(
        `treasury (${treasury.address}) holds ${formatEther(balance)} ETH — too little to onboard an agent`,
      );
    }
  }

  if (problems.length > 0) {
    console.error(`\n[preflight] ${problems.length} problem(s) must be fixed first:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  console.log("[preflight] ready.");
}

main().catch((err) => {
  console.error("[preflight] check failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});

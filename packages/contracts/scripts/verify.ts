import hre from "hardhat";
import { getAddresses, CHAIN_META, type ContractAddresses } from "@agentrail/shared";

/// Verify every deployed contract on the active network's explorers.
///
/// `hardhat verify` takes one address plus its constructor arguments, so
/// verifying a deployment by hand means five invocations and remembering which
/// contract took which argument. Reading both from the generated deployments
/// table removes that step and cannot drift from what was actually deployed.
const CONSTRUCTOR_ARGS = (
  addresses: ContractAddresses,
  deployer: string,
): Record<keyof ContractAddresses, unknown[]> => ({
  MockUSDC: [],
  JobContract: [addresses.MockUSDC],
  IdentityRegistry: [],
  // Deployed with the deployer as owner, so verification has to be told the same
  // address or the bytecode comparison fails.
  ReputationRegistry: [deployer],
  EvaluatorModule: [addresses.JobContract],
});

/// Keyless read-only API used to confirm the result, per chain.
const BLOCKSCOUT_API: Record<number, string> = {
  84532: "https://base-sepolia.blockscout.com/api/v2/smart-contracts",
};

/// Ask an explorer whether it actually holds source for this address.
///
/// This exists because hardhat-verify's programmatic task does not report
/// failure through control flow: it collects each explorer's errors, prints an
/// aggregate, and still resolves with exit code 0. A run that verified two of
/// five contracts looked identical to a clean one. Confirming against the
/// explorer is the only way for this script to know what it actually achieved.
async function holdsSource(api: string, address: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${api}/${address}`);
    if (!res.ok) return res.status === 404 ? false : null;
    const body = (await res.json()) as { source_code?: string };
    return Boolean(body.source_code);
  } catch {
    // Network trouble is not evidence either way, so say so rather than guess.
    return null;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const publicClient = await hre.viem.getPublicClient();
  const chainId = await publicClient.getChainId();
  const addresses = getAddresses(chainId);
  const explorer = CHAIN_META[chainId]?.explorer;

  if (!explorer) {
    throw new Error(`chain ${chainId} has no explorer — nothing to verify against`);
  }

  const [deployer] = await hre.viem.getWalletClients();
  if (!deployer) throw new Error("no accounts configured for this network");
  const args = CONSTRUCTOR_ARGS(addresses, deployer.account.address);
  const names = Object.keys(args) as (keyof ContractAddresses)[];

  for (const name of names) {
    console.log(`\nVerifying ${name} at ${addresses[name]}…`);
    try {
      await hre.run("verify:verify", {
        address: addresses[name],
        constructorArguments: args[name],
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      // Already-verified is the expected outcome of a re-run, not a failure.
      if (!/already verified/i.test(detail)) {
        console.error(`  submit failed: ${detail.split("\n")[0]}`);
      }
    }
    // Submitting five in a row trips the explorers' rate limits, and a rate-limit
    // rejection is one of the errors the plugin swallows.
    await sleep(2_000);
  }

  const api = BLOCKSCOUT_API[chainId];
  if (!api) {
    console.log(`\nNo confirmation API for chain ${chainId} — check ${explorer} by hand.`);
    return;
  }

  console.log("\nConfirming against the explorer:");
  const unconfirmed: string[] = [];
  for (const name of names) {
    // Retried because the explorer indexes a submission asynchronously: checking
    // the instant the submit returns reports NOT verified for a contract that
    // shows up moments later. Spacing also keeps the reads under the rate limit
    // that silently answers with an error body instead of a contract.
    let held: boolean | null = null;
    for (let attempt = 0; attempt < 4 && held !== true; attempt++) {
      if (attempt > 0) await sleep(5_000);
      held = await holdsSource(api, addresses[name]);
    }
    console.log(
      `  ${name} — ${held === null ? "could not check" : held ? "verified" : "NOT verified"}`,
    );
    if (held !== true) unconfirmed.push(name);
    await sleep(3_000);
  }

  if (unconfirmed.length > 0) {
    throw new Error(`not confirmed verified: ${unconfirmed.join(", ")}`);
  }
  console.log(`\nAll five confirmed. ${explorer}/address/${addresses.JobContract}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

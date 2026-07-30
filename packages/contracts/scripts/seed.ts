import hre from "hardhat";
import { getAddresses, agentLabel } from "@agentrail/shared";
import { walletClients } from "./lib/clients";

/// Seeds a fresh demo: registers all three agents in the IdentityRegistry and
/// mints MockUSDC so a hire→settle flow has funds. Run after deploy.
///   npm run seed                 -> localhost (31337)
///   npm run seed:base-sepolia    -> Base Sepolia (84532)
///
/// Idempotent: registerAgent reverts on a second call for the same address, so
/// registration is skipped when isRegistered already returns true. That lets
/// the script be re-run against a chain that cannot be reset — which is the
/// normal case on Base Sepolia.
async function main() {
  const publicClient = await hre.viem.getPublicClient();
  // Resolve against the connected chain, not the active env chain — seeding
  // must target whatever `--network` was passed.
  const chainId = await publicClient.getChainId();
  const addresses = getAddresses(chainId);

  const wallets = (await walletClients()).slice(0, 3);
  const [owner] = wallets;
  if (!owner) throw new Error("no accounts configured for this network");

  // Both writes below are the owner's, not each agent's: registerAgent takes the
  // agent as an argument and mint is owner-only. The other two clients are here
  // only for their addresses.
  const asOwner = { client: { wallet: owner } };
  const usdc = await hre.viem.getContractAt("MockUSDC", addresses.MockUSDC, asOwner);
  const identity = await hre.viem.getContractAt(
    "IdentityRegistry",
    addresses.IdentityRegistry,
    asOwner,
  );

  // 1_000 USDC each (6 decimals). Agent C never pays, but funding it keeps the
  // three symmetric and costs nothing on a mock token.
  const mintAmount = 1_000n * 10n ** 6n;

  /// Retry a read that follows a write on the same chain.
  ///
  /// A public endpoint is a pool of nodes, so a read issued the moment a receipt
  /// arrives can land on either side of that pool's replication lag. Both sides
  /// hurt: reading `latest` returns pre-transaction state from a node that has
  /// not applied the block, and pinning the block number gets "block not found"
  /// from a node that has not received it. Pinning is still right — it can only
  /// fail loudly, never return a wrong answer — but it needs a retry to survive
  /// the lag rather than abort a seed whose transactions all succeeded.
  ///
  /// Only reads are retried. Replaying a write would be a second transaction.
  async function readWithRetry<T>(what: string, read: () => Promise<T>): Promise<T> {
    let last: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await read();
      } catch (err) {
        last = err;
        await new Promise((resolve) => setTimeout(resolve, 1_000 * (attempt + 1)));
      }
    }
    const detail = last instanceof Error ? last.message.split("\n")[0] : String(last);
    throw new Error(`${what} failed after 5 attempts: ${detail}`);
  }

  console.log(`Seeding chain ${chainId}…`);

  for (const wallet of wallets) {
    const address = wallet.account.address;
    const label = agentLabel(address);

    // Retried as well: a stale false here would send a second registerAgent,
    // which reverts "already registered" and fails an otherwise fine re-seed.
    const alreadyRegistered = await readWithRetry(`${label} isRegistered`, () =>
      identity.read.isRegistered([address]),
    );
    if (alreadyRegistered) {
      console.log(`  ${label} — already registered, skipping`);
    } else {
      const hash = await identity.write.registerAgent([address]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error(`${label}: registerAgent reverted`);
      const tokenId = await readWithRetry(`${label} getAgentId`, () =>
        identity.read.getAgentId([address], { blockNumber: receipt.blockNumber }),
      );
      console.log(`  ${label} — registered, tokenId ${tokenId}`);
    }

    const mintHash = await usdc.write.mint([address, mintAmount]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });
    if (receipt.status !== "success") throw new Error(`${label}: mint reverted`);

    const balance = (await readWithRetry(`${label} balanceOf`, () =>
      usdc.read.balanceOf([address], { blockNumber: receipt.blockNumber }),
    )) as bigint;
    console.log(`  ${label} — balance ${balance / 10n ** 6n} USDC`);
  }

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

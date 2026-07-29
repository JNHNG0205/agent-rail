import hre from "hardhat";
import { getAddresses, agentLabel } from "@agentrail/shared";

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

  const [agentA, agentB, agentC] = await hre.viem.getWalletClients();
  const wallets = [agentA, agentB, agentC];

  const usdc = await hre.viem.getContractAt("MockUSDC", addresses.MockUSDC);
  const identity = await hre.viem.getContractAt("IdentityRegistry", addresses.IdentityRegistry);

  // 1_000 USDC each (6 decimals). Agent C never pays, but funding it keeps the
  // three symmetric and costs nothing on a mock token.
  const mintAmount = 1_000n * 10n ** 6n;

  console.log(`Seeding chain ${chainId}…`);

  for (const wallet of wallets) {
    const address = wallet.account.address;
    const label = agentLabel(address);

    const alreadyRegistered = await identity.read.isRegistered([address]);
    if (alreadyRegistered) {
      console.log(`  ${label} — already registered, skipping`);
    } else {
      const hash = await identity.write.registerAgent([address]);
      await publicClient.waitForTransactionReceipt({ hash });
      const tokenId = await identity.read.getAgentId([address]);
      console.log(`  ${label} — registered, tokenId ${tokenId}`);
    }

    const mintHash = await usdc.write.mint([address, mintAmount]);
    await publicClient.waitForTransactionReceipt({ hash: mintHash });
    const balance = await usdc.read.balanceOf([address]);
    console.log(`  ${label} — balance ${balance / 10n ** 6n} USDC`);
  }

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

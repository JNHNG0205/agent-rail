import hre from "hardhat";
import { getAddresses } from "@agentrail/shared";

/// Seeds a fresh demo: registers Agent A + B in the IdentityRegistry and mints
/// MockUSDC to both so a hire→settle flow has funds. Run after deploy.
///   npm run seed                 -> localhost (31337)
///   npm run seed:base-sepolia    -> Base Sepolia (84532)
async function main() {
  const publicClient = await hre.viem.getPublicClient();
  // Resolve against the connected chain, not the active env chain — seeding
  // must target whatever `--network` was passed.
  const addresses = getAddresses(await publicClient.getChainId());

  const [agentA, agentB, agentC] = await hre.viem.getWalletClients();

  const usdc = await hre.viem.getContractAt("MockUSDC", addresses.MockUSDC);
  const identity = await hre.viem.getContractAt("IdentityRegistry", addresses.IdentityRegistry);

  // 1_000 USDC each (6 decimals).
  const mintAmount = 1_000n * 10n ** 6n;

  // TODO(M4): once IdentityRegistry.register / MockUSDC.mint are implemented,
  //           uncomment and finalise the seeding calls below.
  // await usdc.write.mint([agentA.account.address, mintAmount]);
  // await usdc.write.mint([agentB.account.address, mintAmount]);
  // await identity.write.register([agentA.account.address, "Agent A (client)"]);
  // await identity.write.register([agentB.account.address, "Agent B (provider)"]);
  // await identity.write.register([agentC.account.address, "Agent C (evaluator)"]);

  console.log("Seed targets:");
  console.log("  Agent A:", agentA.account.address);
  console.log("  Agent B:", agentB.account.address);
  console.log("  Agent C:", agentC.account.address);
  console.log("  mintAmount:", mintAmount.toString());
  console.log("TODO(M4): wire the register/mint calls once contracts are implemented.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Deploying AgentRail system contracts with Viem...");
  const [deployer] = await hre.viem.getWalletClients();
  console.log("Deployer account:", deployer.account.address);

  // 1. Deploy MockUSDC
  const usdc = await hre.viem.deployContract("MockUSDC");
  console.log("MockUSDC deployed to:", usdc.address);

  // 2. Deploy JobContract
  const jobContract = await hre.viem.deployContract("JobContract", [usdc.address]);
  console.log("JobContract deployed to:", jobContract.address);

  // 3. Deploy IdentityRegistry
  const identityRegistry = await hre.viem.deployContract("IdentityRegistry");
  console.log("IdentityRegistry deployed to:", identityRegistry.address);

  // 4. Deploy ReputationRegistry
  const reputationRegistry = await hre.viem.deployContract("ReputationRegistry", [deployer.account.address]);
  console.log("ReputationRegistry deployed to:", reputationRegistry.address);

  // 5. Deploy EvaluatorModule
  const evaluatorModule = await hre.viem.deployContract("EvaluatorModule", [jobContract.address]);
  console.log("EvaluatorModule deployed to:", evaluatorModule.address);

  // 6. Wire permissions
  console.log("\nConfiguring cross-contract permissions...");
  await jobContract.write.setEvaluatorModule([evaluatorModule.address]);
  await jobContract.write.setReputationRegistry([reputationRegistry.address]);
  await reputationRegistry.write.setJobContract([jobContract.address]);

  console.log("All contracts wired successfully!");

  const addresses = {
    MockUSDC: usdc.address,
    JobContract: jobContract.address,
    IdentityRegistry: identityRegistry.address,
    ReputationRegistry: reputationRegistry.address,
    EvaluatorModule: evaluatorModule.address,
  };

  fs.writeFileSync(path.join(__dirname, "../deployed-addresses.json"), JSON.stringify(addresses, null, 2));

  console.log("\nSaved addresses to deployed-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

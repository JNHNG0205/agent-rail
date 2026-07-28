const hre = require("hardhat");

async function main() {
  console.log("Deploying AgentRail system contracts...");
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer account:", deployer.address);

  // 1. Deploy MockUSDC
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("MockUSDC deployed to:", usdcAddress);

  // 2. Deploy JobContract
  const JobContract = await hre.ethers.getContractFactory("JobContract");
  const jobContract = await JobContract.deploy(usdcAddress);
  await jobContract.waitForDeployment();
  const jobContractAddress = await jobContract.getAddress();
  console.log("JobContract deployed to:", jobContractAddress);

  // 3. Deploy IdentityRegistry
  const IdentityRegistry = await hre.ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  const identityAddress = await identityRegistry.getAddress();
  console.log("IdentityRegistry deployed to:", identityAddress);

  // 4. Deploy ReputationRegistry
  const ReputationRegistry = await hre.ethers.getContractFactory("ReputationRegistry");
  const reputationRegistry = await ReputationRegistry.deploy(deployer.address);
  await reputationRegistry.waitForDeployment();
  const reputationAddress = await reputationRegistry.getAddress();
  console.log("ReputationRegistry deployed to:", reputationAddress);

  // 5. Deploy EvaluatorModule
  const EvaluatorModule = await hre.ethers.getContractFactory("EvaluatorModule");
  const evaluatorModule = await EvaluatorModule.deploy(jobContractAddress);
  await evaluatorModule.waitForDeployment();
  const evaluatorAddress = await evaluatorModule.getAddress();
  console.log("EvaluatorModule deployed to:", evaluatorAddress);

  // 6. Wire permissions
  console.log("\nConfiguring cross-contract permissions...");
  await (await jobContract.setEvaluatorModule(evaluatorAddress)).wait();
  await (await jobContract.setReputationRegistry(reputationAddress)).wait();
  await (await reputationRegistry.setJobContract(jobContractAddress)).wait();

  console.log("All contracts wired successfully!");

  const addresses = {
    MockUSDC: usdcAddress,
    JobContract: jobContractAddress,
    IdentityRegistry: identityAddress,
    ReputationRegistry: reputationAddress,
    EvaluatorModule: evaluatorAddress,
  };

  const fs = require("fs");
  const path = require("path");
  fs.writeFileSync(path.join(__dirname, "../deployed-addresses.json"), JSON.stringify(addresses, null, 2));

  console.log("\nSaved addresses to deployed-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

const hre = require("hardhat");

async function main() {
  console.log("Deploying contracts...");
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("MockUSDC deployed to:", usdcAddress);

  const JobContract = await hre.ethers.getContractFactory("JobContract");
  const jobContract = await JobContract.deploy(usdcAddress);
  await jobContract.waitForDeployment();
  const jobContractAddress = await jobContract.getAddress();
  console.log("JobContract deployed to:", jobContractAddress);

  const IdentityRegistry = await hre.ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  const identityAddress = await identityRegistry.getAddress();
  console.log("IdentityRegistry deployed to:", identityAddress);

  const ReputationRegistry = await hre.ethers.getContractFactory("ReputationRegistry");
  const reputationRegistry = await ReputationRegistry.deploy(deployer.address);
  await reputationRegistry.waitForDeployment();
  const reputationAddress = await reputationRegistry.getAddress();
  console.log("ReputationRegistry deployed to:", reputationAddress);

  const addresses = {
    MockUSDC: usdcAddress,
    JobContract: jobContractAddress,
    IdentityRegistry: identityAddress,
    ReputationRegistry: reputationAddress,
  };

  const fs = require("fs");
  const path = require("path");
  fs.writeFileSync(path.join(__dirname, "../deployed-addresses.json"), JSON.stringify(addresses, null, 2));

  console.log("\n=======================================================");
  console.log(" Copy & Paste this directly into hardhat console:");
  console.log("-------------------------------------------------------");
  console.log(`const [deployer, agentA, agentB, evaluator] = await ethers.getSigners();`);
  console.log(`const usdc = await ethers.getContractAt("MockUSDC", "${usdcAddress}");`);
  console.log(`const jobContract = await ethers.getContractAt("JobContract", "${jobContractAddress}");`);
  console.log("=======================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  console.log("Seeding test accounts with MockUSDC...");
  const signers = await hre.ethers.getSigners();
  const [deployer, agentA, agentB] = signers;

  const addressesFile = path.join(__dirname, "../deployed-addresses.json");
  let usdcAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  if (fs.existsSync(addressesFile)) {
    const data = JSON.parse(fs.readFileSync(addressesFile, "utf8"));
    if (data.MockUSDC) usdcAddress = data.MockUSDC;
  }

  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = MockUSDC.attach(usdcAddress);
  const mintAmount = hre.ethers.parseUnits("1000", 6);

  await (await usdc.mint(agentA.address, mintAmount)).wait();
  await (await usdc.mint(agentB.address, mintAmount)).wait();

  console.log(`Successfully minted 1,000 USDC to Agent A (${agentA.address}) and Agent B (${agentB.address}) at MockUSDC: ${usdcAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

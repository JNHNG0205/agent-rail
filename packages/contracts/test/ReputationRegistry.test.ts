import { expect } from "chai";
import hre from "hardhat";

describe("ReputationRegistry (Viem)", function () {
  async function deployFixture() {
    const [owner, jobContractSim, agent] = await hre.viem.getWalletClients();
    const reputationRegistry = await hre.viem.deployContract("ReputationRegistry", [
      owner.account.address,
    ]);
    return { reputationRegistry, owner, jobContractSim, agent };
  }

  it("should revert recordCompletion if JobContract is not set", async function () {
    const { reputationRegistry, jobContractSim, agent } = await deployFixture();

    const repAsJobContract = await hre.viem.getContractAt(
      "ReputationRegistry",
      reputationRegistry.address,
      { client: { wallet: jobContractSim } }
    );

    await expect(repAsJobContract.write.recordCompletion([agent.account.address])).to.be.rejectedWith(
      "ReputationRegistry: JobContract not set"
    );
  });

  it("should allow owner to set JobContract address", async function () {
    const { reputationRegistry, jobContractSim } = await deployFixture();

    await reputationRegistry.write.setJobContract([jobContractSim.account.address]);

    expect((await reputationRegistry.read.jobContract()).toLowerCase()).to.equal(
      jobContractSim.account.address.toLowerCase()
    );
  });

  it("should increment reputation score when called by authorized JobContract", async function () {
    const { reputationRegistry, jobContractSim, agent } = await deployFixture();

    await reputationRegistry.write.setJobContract([jobContractSim.account.address]);

    const repAsJobContract = await hre.viem.getContractAt(
      "ReputationRegistry",
      reputationRegistry.address,
      { client: { wallet: jobContractSim } }
    );

    await repAsJobContract.write.recordCompletion([agent.account.address]);
    expect(await reputationRegistry.read.getReputation([agent.account.address])).to.equal(1n);

    await repAsJobContract.write.recordCompletion([agent.account.address]);
    expect(await reputationRegistry.read.getReputation([agent.account.address])).to.equal(2n);
  });

  it("should revert recordCompletion if caller is not authorized JobContract", async function () {
    const { reputationRegistry, jobContractSim, agent } = await deployFixture();

    await reputationRegistry.write.setJobContract([jobContractSim.account.address]);

    await expect(reputationRegistry.write.recordCompletion([agent.account.address])).to.be.rejectedWith(
      "ReputationRegistry: caller is not authorized JobContract"
    );
  });
});

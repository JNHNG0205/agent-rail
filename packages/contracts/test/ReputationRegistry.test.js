const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReputationRegistry", function () {
  let reputationRegistry;
  let owner, jobContractSim, agent;

  beforeEach(async function () {
    [owner, jobContractSim, agent] = await ethers.getSigners();
    const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
    reputationRegistry = await ReputationRegistry.deploy(owner.address);
  });

  it("should revert recordCompletion if JobContract is not set", async function () {
    await expect(reputationRegistry.connect(jobContractSim).recordCompletion(agent.address)).to.be.revertedWith(
      "ReputationRegistry: JobContract not set"
    );
  });

  it("should allow owner to set JobContract address", async function () {
    await expect(reputationRegistry.setJobContract(jobContractSim.address))
      .to.emit(reputationRegistry, "JobContractUpdated")
      .withArgs(jobContractSim.address);

    expect(await reputationRegistry.jobContract()).to.equal(jobContractSim.address);
  });

  it("should increment reputation score when called by authorized JobContract", async function () {
    await reputationRegistry.setJobContract(jobContractSim.address);

    await expect(reputationRegistry.connect(jobContractSim).recordCompletion(agent.address))
      .to.emit(reputationRegistry, "ReputationUpdated")
      .withArgs(agent.address, 1n);

    expect(await reputationRegistry.getReputation(agent.address)).to.equal(1n);

    await reputationRegistry.connect(jobContractSim).recordCompletion(agent.address);
    expect(await reputationRegistry.getReputation(agent.address)).to.equal(2n);
  });

  it("should revert recordCompletion if caller is not authorized JobContract", async function () {
    await reputationRegistry.setJobContract(jobContractSim.address);
    await expect(reputationRegistry.connect(owner).recordCompletion(agent.address)).to.be.revertedWith(
      "ReputationRegistry: caller is not authorized JobContract"
    );
  });
});

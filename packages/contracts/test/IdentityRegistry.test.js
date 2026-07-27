const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IdentityRegistry", function () {
  let identityRegistry;
  let owner, agent1, agent2;

  beforeEach(async function () {
    [owner, agent1, agent2] = await ethers.getSigners();
    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy();
  });

  it("should register an agent and mint token ID 0", async function () {
    const tx = await identityRegistry.registerAgent(agent1.address);
    await tx.wait();

    expect(await identityRegistry.isRegistered(agent1.address)).to.equal(true);
    expect(await identityRegistry.getAgentId(agent1.address)).to.equal(0n);
    expect(await identityRegistry.getAgentAddress(0)).to.equal(agent1.address);
  });

  it("should increment token IDs for subsequent registrations", async function () {
    await identityRegistry.registerAgent(agent1.address);
    await identityRegistry.registerAgent(agent2.address);

    expect(await identityRegistry.getAgentId(agent2.address)).to.equal(1n);
    expect(await identityRegistry.getAgentAddress(1)).to.equal(agent2.address);
  });

  it("should revert if agent address is already registered", async function () {
    await identityRegistry.registerAgent(agent1.address);
    await expect(identityRegistry.registerAgent(agent1.address)).to.be.revertedWith(
      "IdentityRegistry: agent already registered"
    );
  });

  it("should revert if querying unregistered agent ID", async function () {
    await expect(identityRegistry.getAgentId(agent1.address)).to.be.revertedWith(
      "IdentityRegistry: agent not registered"
    );
  });
});

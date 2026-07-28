import { expect } from "chai";
import hre from "hardhat";

describe("IdentityRegistry (Viem)", function () {
  async function deployFixture() {
    const [owner, agent1, agent2] = await hre.viem.getWalletClients();
    const identityRegistry = await hre.viem.deployContract("IdentityRegistry");
    return { identityRegistry, owner, agent1, agent2 };
  }

  it("should register an agent and mint token ID 0", async function () {
    const { identityRegistry, agent1 } = await deployFixture();

    await identityRegistry.write.registerAgent([agent1.account.address]);

    expect(await identityRegistry.read.isRegistered([agent1.account.address])).to.equal(true);
    expect(await identityRegistry.read.getAgentId([agent1.account.address])).to.equal(0n);
    expect(((await identityRegistry.read.getAgentAddress([0n])) as string).toLowerCase()).to.equal(
      agent1.account.address.toLowerCase()
    );
  });

  it("should increment token IDs for subsequent registrations", async function () {
    const { identityRegistry, agent1, agent2 } = await deployFixture();

    await identityRegistry.write.registerAgent([agent1.account.address]);
    await identityRegistry.write.registerAgent([agent2.account.address]);

    expect(await identityRegistry.read.getAgentId([agent2.account.address])).to.equal(1n);
    expect(((await identityRegistry.read.getAgentAddress([1n])) as string).toLowerCase()).to.equal(
      agent2.account.address.toLowerCase()
    );
  });

  it("should revert if agent address is already registered", async function () {
    const { identityRegistry, agent1 } = await deployFixture();

    await identityRegistry.write.registerAgent([agent1.account.address]);
    await expect(identityRegistry.write.registerAgent([agent1.account.address])).to.be.rejectedWith(
      "IdentityRegistry: agent already registered"
    );
  });

  it("should revert if querying unregistered agent ID", async function () {
    const { identityRegistry, agent1 } = await deployFixture();

    await expect(identityRegistry.read.getAgentId([agent1.account.address])).to.be.rejectedWith(
      "IdentityRegistry: agent not registered"
    );
  });

  it("should revert if registering zero address agent", async function () {
    const { identityRegistry } = await deployFixture();

    await expect(
      identityRegistry.write.registerAgent(["0x0000000000000000000000000000000000000000"])
    ).to.be.rejectedWith("IdentityRegistry: invalid agent address");
  });
});

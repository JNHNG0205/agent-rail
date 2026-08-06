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

  describe("Soulbinding", function () {
    it("should revert on transferFrom of an identity token", async function () {
      const { identityRegistry, agent1, agent2 } = await deployFixture();
      await identityRegistry.write.registerAgent([agent1.account.address]);

      // Sent by the holder, so it fails on soulbinding rather than on authorisation.
      await expect(
        identityRegistry.write.transferFrom(
          [agent1.account.address, agent2.account.address, 0n],
          { account: agent1.account }
        )
      ).to.be.rejectedWith("Soulbound");
    });

    it("should revert on safeTransferFrom of an identity token", async function () {
      const { identityRegistry, agent1, agent2 } = await deployFixture();
      await identityRegistry.write.registerAgent([agent1.account.address]);

      await expect(
        identityRegistry.write.safeTransferFrom(
          [agent1.account.address, agent2.account.address, 0n],
          { account: agent1.account }
        )
      ).to.be.rejectedWith("Soulbound");
    });

    it("should revert on approve and setApprovalForAll", async function () {
      const { identityRegistry, agent1, agent2 } = await deployFixture();
      await identityRegistry.write.registerAgent([agent1.account.address]);

      await expect(
        identityRegistry.write.approve([agent2.account.address, 0n], { account: agent1.account })
      ).to.be.rejectedWith("Soulbound");

      await expect(
        identityRegistry.write.setApprovalForAll([agent2.account.address, true], {
          account: agent1.account,
        })
      ).to.be.rejectedWith("Soulbound");
    });

    it("should keep the address mappings and ownerOf in agreement", async function () {
      // The reason soulbinding matters: _registered and _agentTokenId are keyed
      // by address and never updated after minting, so a successful transfer
      // would leave these three reads describing different holders.
      const { identityRegistry, agent1 } = await deployFixture();
      await identityRegistry.write.registerAgent([agent1.account.address]);

      expect(await identityRegistry.read.isRegistered([agent1.account.address])).to.equal(true);
      expect(await identityRegistry.read.getAgentId([agent1.account.address])).to.equal(0n);
      expect(((await identityRegistry.read.getAgentAddress([0n])) as string).toLowerCase()).to.equal(
        agent1.account.address.toLowerCase()
      );
    });
  });
});

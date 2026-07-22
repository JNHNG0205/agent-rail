import { expect } from "chai";
import hre from "hardhat";

/// State-transition tests for JobContract: Open -> Funded -> Submitted ->
/// Terminal, plus cancel/refund. Member 1.
describe("JobContract", () => {
  async function deployFixture() {
    const [client, provider] = await hre.viem.getWalletClients();
    const usdc = await hre.viem.deployContract("MockUSDC");
    const job = await hre.viem.deployContract("JobContract", [usdc.address]);
    return { job, usdc, client, provider };
  }

  it("deploys with the USDC token wired in", async () => {
    const { job, usdc } = await deployFixture();
    expect((await job.read.usdc()).toLowerCase()).to.equal(usdc.address.toLowerCase());
  });

  it("creates an Open job"); // TODO(M1)
  it("funds an Open job into escrow, moving it to Funded"); // TODO(M1)
  it("accepts a deliverable, moving Funded -> Submitted"); // TODO(M1)
  it("settles to the provider, moving Submitted -> Terminal"); // TODO(M1)
  it("refunds the client on cancel"); // TODO(M1)
});

import { expect } from "chai";
import hre from "hardhat";

/// Signature-verification tests for EvaluatorModule: a valid client approval
/// recovers to the client and settles; a forged/wrong signature reverts.
/// Member 2.
describe("EvaluatorModule", () => {
  async function deployFixture() {
    const usdc = await hre.viem.deployContract("MockUSDC");
    const job = await hre.viem.deployContract("JobContract", [usdc.address]);
    const evaluator = await hre.viem.deployContract("EvaluatorModule", [job.address]);
    return { job, evaluator };
  }

  it("wires the JobContract address", async () => {
    const { job, evaluator } = await deployFixture();
    expect((await evaluator.read.jobContract()).toLowerCase()).to.equal(job.address.toLowerCase());
  });

  it("recovers the client as signer for a valid approval"); // TODO(M2)
  it("reverts when the signature is not from the job client"); // TODO(M2)
  it("settles the job on a verified approval"); // TODO(M2)
});

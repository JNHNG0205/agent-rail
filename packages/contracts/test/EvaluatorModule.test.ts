import { expect } from "chai";
import hre from "hardhat";
import { keccak256, encodePacked, parseUnits, toBytes, concatHex } from "viem";

describe("EvaluatorModule — Unit Tests (ECDSA Signature Verification via Viem)", function () {
  const JOB_AMOUNT = parseUnits("100", 6);
  const DELIVERABLE_TEXT = "Output Deliverable Report v1";
  const DELIVERABLE_HASH = keccak256(toBytes(DELIVERABLE_TEXT));
  const WRONG_HASH = keccak256(toBytes("Wrong Deliverable Hash"));

  async function deployFixture() {
    const [owner, clientAgent, providerAgent, evaluatorAgent, unauthorizedSigner] =
      await hre.viem.getWalletClients();

    const mockUSDC = await hre.viem.deployContract("MockUSDC");
    const jobContract = await hre.viem.deployContract("JobContract", [mockUSDC.address]);
    const reputationRegistry = await hre.viem.deployContract("ReputationRegistry", [
      owner.account.address,
    ]);
    const evaluatorModule = await hre.viem.deployContract("EvaluatorModule", [
      jobContract.address,
    ]);

    await jobContract.write.setEvaluatorModule([evaluatorModule.address]);
    await jobContract.write.setReputationRegistry([reputationRegistry.address]);
    await reputationRegistry.write.setJobContract([jobContract.address]);

    await mockUSDC.write.mint([clientAgent.account.address, JOB_AMOUNT]);

    const usdcAsClient = await hre.viem.getContractAt("MockUSDC", mockUSDC.address, {
      client: { wallet: clientAgent },
    });
    const jobAsClient = await hre.viem.getContractAt("JobContract", jobContract.address, {
      client: { wallet: clientAgent },
    });
    const jobAsProvider = await hre.viem.getContractAt("JobContract", jobContract.address, {
      client: { wallet: providerAgent },
    });

    await usdcAsClient.write.approve([jobContract.address, JOB_AMOUNT]);
    await jobAsClient.write.createJob([
      providerAgent.account.address,
      evaluatorAgent.account.address,
      JOB_AMOUNT,
    ]);

    const jobId = 0n;
    await jobAsClient.write.fundJob([jobId]);
    await jobAsProvider.write.submitDeliverable([jobId, DELIVERABLE_HASH]);

    return {
      mockUSDC,
      jobContract,
      reputationRegistry,
      evaluatorModule,
      owner,
      clientAgent,
      providerAgent,
      evaluatorAgent,
      unauthorizedSigner,
      jobId,
    };
  }

  describe("Constructor Validations", function () {
    it("Should set the correct jobContract address", async function () {
      const { evaluatorModule, jobContract } = await deployFixture();
      expect(((await evaluatorModule.read.jobContract()) as string).toLowerCase()).to.equal(
        jobContract.address.toLowerCase()
      );
    });

    it("Should revert if initialized with zero address", async function () {
      await expect(
        hre.viem.deployContract("EvaluatorModule", [
          "0x0000000000000000000000000000000000000000",
        ])
      ).to.be.rejectedWith("ZeroAddress");
    });
  });

  describe("Signature Verification & Approval (submitApproval - approved: true)", function () {
    it("Should verify valid evaluator signature, settle job, release USDC to provider, and update reputation", async function () {
      const {
        evaluatorModule,
        jobContract,
        mockUSDC,
        reputationRegistry,
        evaluatorAgent,
        providerAgent,
        jobId,
      } = await deployFixture();

      // Reconstruct EIP-191 message hash matching contract logic:
      // keccak256(abi.encodePacked(jobId, deliverableHash, approved))
      const messageHash = keccak256(
        encodePacked(["uint256", "bytes32", "bool"], [jobId, DELIVERABLE_HASH, true])
      );

      const signature = await evaluatorAgent.signMessage({
        message: { raw: messageHash },
      });

      const providerBalanceBefore = (await mockUSDC.read.balanceOf([providerAgent.account.address])) as bigint;

      await evaluatorModule.write.submitApproval([jobId, DELIVERABLE_HASH, true, signature]);

      const job = (await jobContract.read.getJob([jobId])) as { state: number };
      expect(job.state).to.equal(3); // Terminal

      const providerBalanceAfter = (await mockUSDC.read.balanceOf([providerAgent.account.address])) as bigint;
      expect(providerBalanceAfter - providerBalanceBefore).to.equal(JOB_AMOUNT);
      expect(await reputationRegistry.read.getReputation([providerAgent.account.address])).to.equal(
        1n
      );
    });
  });

  describe("Signature Verification & Rejection (submitApproval - approved: false)", function () {
    it("Should verify valid evaluator rejection signature, cancel job, and refund USDC to client", async function () {
      const { evaluatorModule, jobContract, mockUSDC, evaluatorAgent, clientAgent, jobId } =
        await deployFixture();

      const messageHash = keccak256(
        encodePacked(["uint256", "bytes32", "bool"], [jobId, DELIVERABLE_HASH, false])
      );

      const signature = await evaluatorAgent.signMessage({
        message: { raw: messageHash },
      });

      const clientBalanceBefore = (await mockUSDC.read.balanceOf([clientAgent.account.address])) as bigint;

      await evaluatorModule.write.submitApproval([jobId, DELIVERABLE_HASH, false, signature]);

      const job = (await jobContract.read.getJob([jobId])) as { state: number };
      expect(job.state).to.equal(3); // Terminal

      const clientBalanceAfter = (await mockUSDC.read.balanceOf([clientAgent.account.address])) as bigint;
      expect(clientBalanceAfter - clientBalanceBefore).to.equal(JOB_AMOUNT);
    });
  });

  describe("Signature Failure & Validation Edge Cases", function () {
    it("Should revert DeliverableMismatch if deliverable hash does not match job record", async function () {
      const { evaluatorModule, evaluatorAgent, jobId } = await deployFixture();

      const messageHash = keccak256(
        encodePacked(["uint256", "bytes32", "bool"], [jobId, WRONG_HASH, true])
      );

      const signature = await evaluatorAgent.signMessage({
        message: { raw: messageHash },
      });

      await expect(
        evaluatorModule.write.submitApproval([jobId, WRONG_HASH, true, signature])
      ).to.be.rejectedWith("DeliverableMismatch");
    });

    it("Should revert NotAuthorizedEvaluator if message is signed by unauthorized address", async function () {
      const { evaluatorModule, unauthorizedSigner, jobId } = await deployFixture();

      const messageHash = keccak256(
        encodePacked(["uint256", "bytes32", "bool"], [jobId, DELIVERABLE_HASH, true])
      );

      const signature = await unauthorizedSigner.signMessage({
        message: { raw: messageHash },
      });

      await expect(
        evaluatorModule.write.submitApproval([jobId, DELIVERABLE_HASH, true, signature])
      ).to.be.rejectedWith("NotAuthorizedEvaluator");
    });

    it("Should revert NotAuthorizedEvaluator if valid signature for job 0 is replayed against job 1", async function () {
      const {
        evaluatorModule,
        jobContract,
        mockUSDC,
        clientAgent,
        providerAgent,
        evaluatorAgent,
        jobId,
      } = await deployFixture();

      // Create & submit job 1
      const usdcAsClient = await hre.viem.getContractAt("MockUSDC", mockUSDC.address, {
        client: { wallet: clientAgent },
      });
      const jobAsClient = await hre.viem.getContractAt("JobContract", jobContract.address, {
        client: { wallet: clientAgent },
      });
      const jobAsProvider = await hre.viem.getContractAt("JobContract", jobContract.address, {
        client: { wallet: providerAgent },
      });

      await mockUSDC.write.mint([clientAgent.account.address, JOB_AMOUNT]);
      await usdcAsClient.write.approve([jobContract.address, JOB_AMOUNT]);
      await jobAsClient.write.createJob([
        providerAgent.account.address,
        evaluatorAgent.account.address,
        JOB_AMOUNT,
      ]);

      const job1Id = 1n;
      await jobAsClient.write.fundJob([job1Id]);
      await jobAsProvider.write.submitDeliverable([job1Id, DELIVERABLE_HASH]);

      // Generate signature for job 0
      const messageHashJob0 = keccak256(
        encodePacked(["uint256", "bytes32", "bool"], [jobId, DELIVERABLE_HASH, true])
      );

      const signatureJob0 = await evaluatorAgent.signMessage({
        message: { raw: messageHashJob0 },
      });

      // Replay against job 1
      await expect(
        evaluatorModule.write.submitApproval([job1Id, DELIVERABLE_HASH, true, signatureJob0])
      ).to.be.rejectedWith("NotAuthorizedEvaluator");
    });
  });
});

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EvaluatorModule — Unit Tests (ECDSA Signature Verification)", function () {
  let mockUSDC;
  let jobContract;
  let reputationRegistry;
  let evaluatorModule;

  let owner;
  let clientAgent;
  let providerAgent;
  let evaluatorAgent;
  let unauthorizedSigner;

  const JOB_AMOUNT = ethers.parseUnits("100", 6);
  const DELIVERABLE_TEXT = "Output Deliverable Report v1";
  const DELIVERABLE_HASH = ethers.keccak256(ethers.toUtf8Bytes(DELIVERABLE_TEXT));
  const WRONG_HASH = ethers.keccak256(ethers.toUtf8Bytes("Wrong Deliverable Hash"));

  let jobId;

  beforeEach(async function () {
    [owner, clientAgent, providerAgent, evaluatorAgent, unauthorizedSigner] = await ethers.getSigners();

    // 1. Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    // 2. Deploy JobContract
    const JobContract = await ethers.getContractFactory("JobContract");
    jobContract = await JobContract.deploy(await mockUSDC.getAddress());
    await jobContract.waitForDeployment();

    // 3. Deploy ReputationRegistry
    const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
    reputationRegistry = await ReputationRegistry.deploy(owner.address);
    await reputationRegistry.waitForDeployment();

    // 4. Deploy EvaluatorModule
    const EvaluatorModule = await ethers.getContractFactory("EvaluatorModule");
    evaluatorModule = await EvaluatorModule.deploy(await jobContract.getAddress());
    await evaluatorModule.waitForDeployment();

    // 5. Connect Cross-Contract Permissions
    await jobContract.setEvaluatorModule(await evaluatorModule.getAddress());
    await jobContract.setReputationRegistry(await reputationRegistry.getAddress());
    await reputationRegistry.setJobContract(await jobContract.getAddress());

    // Fund Client with USDC & setup job in Submitted state
    await mockUSDC.mint(clientAgent.address, JOB_AMOUNT);
    await mockUSDC.connect(clientAgent).approve(await jobContract.getAddress(), JOB_AMOUNT);

    await jobContract.connect(clientAgent).createJob(providerAgent.address, evaluatorAgent.address, JOB_AMOUNT);
    jobId = 0n;

    await jobContract.connect(clientAgent).fundJob(jobId);
    await jobContract.connect(providerAgent).submitDeliverable(jobId, DELIVERABLE_HASH);
  });

  describe("Constructor Validations", function () {
    it("Should set the correct jobContract address", async function () {
      expect(await evaluatorModule.jobContract()).to.equal(await jobContract.getAddress());
    });

    it("Should revert if deployed with zero address for jobContract", async function () {
      const EvaluatorModule = await ethers.getContractFactory("EvaluatorModule");
      await expect(EvaluatorModule.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        EvaluatorModule,
        "ZeroAddress"
      );
    });
  });

  describe("Signature Verification & Approval (submitApproval - approved: true)", function () {
    it("Should verify valid evaluator signature, settle job, release USDC to provider, and update reputation", async function () {
      const messageHash = ethers.solidityPackedKeccak256(
        ["uint256", "bytes32", "bool"],
        [jobId, DELIVERABLE_HASH, true]
      );
      const signature = await evaluatorAgent.signMessage(ethers.getBytes(messageHash));

      const providerBalanceBefore = await mockUSDC.balanceOf(providerAgent.address);

      await expect(evaluatorModule.submitApproval(jobId, DELIVERABLE_HASH, true, signature))
        .to.emit(evaluatorModule, "ApprovalProcessed")
        .withArgs(jobId, evaluatorAgent.address, true)
        .and.to.emit(jobContract, "JobCompleted")
        .withArgs(jobId, providerAgent.address, JOB_AMOUNT)
        .and.to.emit(reputationRegistry, "ReputationUpdated")
        .withArgs(providerAgent.address, 1n);

      const job = await jobContract.getJob(jobId);
      expect(job.state).to.equal(3); // JobState.Terminal

      const providerBalanceAfter = await mockUSDC.balanceOf(providerAgent.address);
      expect(providerBalanceAfter - providerBalanceBefore).to.equal(JOB_AMOUNT);
      expect(await reputationRegistry.getReputation(providerAgent.address)).to.equal(1n);
    });
  });

  describe("Signature Verification & Rejection (submitApproval - approved: false)", function () {
    it("Should verify valid evaluator rejection signature, cancel job, and refund USDC to client", async function () {
      const messageHash = ethers.solidityPackedKeccak256(
        ["uint256", "bytes32", "bool"],
        [jobId, DELIVERABLE_HASH, false]
      );
      const signature = await evaluatorAgent.signMessage(ethers.getBytes(messageHash));

      const clientBalanceBefore = await mockUSDC.balanceOf(clientAgent.address);

      await expect(evaluatorModule.submitApproval(jobId, DELIVERABLE_HASH, false, signature))
        .to.emit(evaluatorModule, "ApprovalProcessed")
        .withArgs(jobId, evaluatorAgent.address, false)
        .and.to.emit(jobContract, "JobCancelled")
        .withArgs(jobId, clientAgent.address, JOB_AMOUNT);

      const job = await jobContract.getJob(jobId);
      expect(job.state).to.equal(3); // JobState.Terminal

      const clientBalanceAfter = await mockUSDC.balanceOf(clientAgent.address);
      expect(clientBalanceAfter - clientBalanceBefore).to.equal(JOB_AMOUNT);
      expect(await reputationRegistry.getReputation(providerAgent.address)).to.equal(0n);
    });
  });

  describe("Signature Failure & Validation Edge Cases", function () {
    it("Should revert DeliverableMismatch if deliverable hash does not match job record", async function () {
      const messageHash = ethers.solidityPackedKeccak256(
        ["uint256", "bytes32", "bool"],
        [jobId, WRONG_HASH, true]
      );
      const signature = await evaluatorAgent.signMessage(ethers.getBytes(messageHash));

      await expect(
        evaluatorModule.submitApproval(jobId, WRONG_HASH, true, signature)
      )
        .to.be.revertedWithCustomError(evaluatorModule, "DeliverableMismatch")
        .withArgs(WRONG_HASH, DELIVERABLE_HASH);
    });

    it("Should revert NotAuthorizedEvaluator if message is signed by unauthorized address", async function () {
      const messageHash = ethers.solidityPackedKeccak256(
        ["uint256", "bytes32", "bool"],
        [jobId, DELIVERABLE_HASH, true]
      );
      const signature = await unauthorizedSigner.signMessage(ethers.getBytes(messageHash));

      await expect(
        evaluatorModule.submitApproval(jobId, DELIVERABLE_HASH, true, signature)
      )
        .to.be.revertedWithCustomError(evaluatorModule, "NotAuthorizedEvaluator")
        .withArgs(unauthorizedSigner.address, evaluatorAgent.address);
    });

    it("Should revert NotAuthorizedEvaluator if valid signature for job 0 is replayed against job 1", async function () {
      // Setup job 1
      await mockUSDC.mint(clientAgent.address, JOB_AMOUNT);
      await mockUSDC.connect(clientAgent).approve(await jobContract.getAddress(), JOB_AMOUNT);
      await jobContract.connect(clientAgent).createJob(providerAgent.address, evaluatorAgent.address, JOB_AMOUNT);
      const job1Id = 1n;
      await jobContract.connect(clientAgent).fundJob(job1Id);
      await jobContract.connect(providerAgent).submitDeliverable(job1Id, DELIVERABLE_HASH);

      // Generate valid signature for job 0
      const messageHashJob0 = ethers.solidityPackedKeccak256(
        ["uint256", "bytes32", "bool"],
        [jobId, DELIVERABLE_HASH, true]
      );
      const signatureJob0 = await evaluatorAgent.signMessage(ethers.getBytes(messageHashJob0));

      // Replay job 0's signature against job 1
      await expect(
        evaluatorModule.submitApproval(job1Id, DELIVERABLE_HASH, true, signatureJob0)
      ).to.be.revertedWithCustomError(evaluatorModule, "NotAuthorizedEvaluator");
    });

    it("Should revert if signature is forged or corrupted", async function () {
      const messageHash = ethers.solidityPackedKeccak256(
        ["uint256", "bytes32", "bool"],
        [jobId, DELIVERABLE_HASH, true]
      );
      let signature = await evaluatorAgent.signMessage(ethers.getBytes(messageHash));
      
      // Corrupt the signature bytes
      const corruptedSig = signature.slice(0, -4) + "0000";

      await expect(
        evaluatorModule.submitApproval(jobId, DELIVERABLE_HASH, true, corruptedSig)
      ).to.be.reverted;
    });
  });
});

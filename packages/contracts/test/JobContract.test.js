const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("JobContract - Core Business Logic & USDC Escrow", function () {
  let mockUSDC;
  let jobContract;
  let owner;
  let client;
  let provider;
  let evaluator;
  let stranger;

  const INITIAL_MINT = ethers.parseUnits("1000", 6); // 1,000 USDC
  const JOB_AMOUNT = ethers.parseUnits("100", 6);    // 100 USDC
  const DELIVERABLE_HASH = ethers.keccak256(ethers.toUtf8Bytes("deliverable_result_v1"));

  beforeEach(async function () {
    [owner, client, provider, evaluator, stranger] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    // Deploy JobContract
    const JobContract = await ethers.getContractFactory("JobContract");
    jobContract = await JobContract.deploy(await mockUSDC.getAddress());
    await jobContract.waitForDeployment();

    // Mint USDC for client
    await mockUSDC.mint(client.address, INITIAL_MINT);
  });

  describe("Constructor & Zero Input Validations", function () {
    it("Should set the correct USDC address", async function () {
      expect(await jobContract.usdc()).to.equal(await mockUSDC.getAddress());
    });

    it("Should revert if deployed with zero address for USDC", async function () {
      const JobContract = await ethers.getContractFactory("JobContract");
      await expect(JobContract.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        JobContract,
        "ZeroAddress"
      );
    });

    it("Should revert createJob if provider or evaluator is zero address", async function () {
      await expect(
        jobContract.connect(client).createJob(ethers.ZeroAddress, evaluator.address, JOB_AMOUNT)
      ).to.be.revertedWithCustomError(jobContract, "ZeroAddress");

      await expect(
        jobContract.connect(client).createJob(provider.address, ethers.ZeroAddress, JOB_AMOUNT)
      ).to.be.revertedWithCustomError(jobContract, "ZeroAddress");
    });

    it("Should revert createJob if amount is zero", async function () {
      await expect(
        jobContract.connect(client).createJob(provider.address, evaluator.address, 0)
      ).to.be.revertedWithCustomError(jobContract, "ZeroAmount");
    });
  });

  describe("Happy Path Lifecycle (Open -> Funded -> Submitted -> Terminal)", function () {
    let jobId;

    beforeEach(async function () {
      const tx = await jobContract.connect(client).createJob(provider.address, evaluator.address, JOB_AMOUNT);
      const receipt = await tx.wait();
      jobId = 0; // First job
    });

    it("Should initialize job in Open state", async function () {
      const job = await jobContract.getJob(jobId);
      expect(job.client).to.equal(client.address);
      expect(job.provider).to.equal(provider.address);
      expect(job.evaluator).to.equal(evaluator.address);
      expect(job.amount).to.equal(JOB_AMOUNT);
      expect(job.state).to.equal(0); // JobState.Open
    });

    it("Should fund job and transfer USDC into escrow", async function () {
      await mockUSDC.connect(client).approve(await jobContract.getAddress(), JOB_AMOUNT);

      await expect(jobContract.connect(client).fundJob(jobId))
        .to.emit(jobContract, "JobFunded")
        .withArgs(jobId, JOB_AMOUNT);

      const job = await jobContract.getJob(jobId);
      expect(job.state).to.equal(1); // JobState.Funded

      const escrowBalance = await mockUSDC.balanceOf(await jobContract.getAddress());
      expect(escrowBalance).to.equal(JOB_AMOUNT);
    });

    it("Should allow provider to submit deliverable", async function () {
      await mockUSDC.connect(client).approve(await jobContract.getAddress(), JOB_AMOUNT);
      await jobContract.connect(client).fundJob(jobId);

      await expect(jobContract.connect(provider).submitDeliverable(jobId, DELIVERABLE_HASH))
        .to.emit(jobContract, "DeliverableSubmitted")
        .withArgs(jobId, DELIVERABLE_HASH);

      const job = await jobContract.getJob(jobId);
      expect(job.state).to.equal(2); // JobState.Submitted
      expect(job.deliverableHash).to.equal(DELIVERABLE_HASH);
    });

    it("Should allow evaluator to settle job and release funds to provider", async function () {
      await mockUSDC.connect(client).approve(await jobContract.getAddress(), JOB_AMOUNT);
      await jobContract.connect(client).fundJob(jobId);
      await jobContract.connect(provider).submitDeliverable(jobId, DELIVERABLE_HASH);

      const providerInitialBalance = await mockUSDC.balanceOf(provider.address);

      await expect(jobContract.connect(evaluator).settle(jobId))
        .to.emit(jobContract, "JobCompleted")
        .withArgs(jobId, provider.address, JOB_AMOUNT);

      const job = await jobContract.getJob(jobId);
      expect(job.state).to.equal(3); // JobState.Terminal

      const providerFinalBalance = await mockUSDC.balanceOf(provider.address);
      expect(providerFinalBalance - providerInitialBalance).to.equal(JOB_AMOUNT);

      const escrowBalance = await mockUSDC.balanceOf(await jobContract.getAddress());
      expect(escrowBalance).to.equal(0);
    });
  });

  describe("Cancellation Path", function () {
    let jobId;

    beforeEach(async function () {
      await jobContract.connect(client).createJob(provider.address, evaluator.address, JOB_AMOUNT);
      jobId = 0;
    });

    it("Should allow client to cancel unfunded job", async function () {
      await expect(jobContract.connect(client).cancel(jobId))
        .to.emit(jobContract, "JobCancelled")
        .withArgs(jobId, client.address, 0);

      const job = await jobContract.getJob(jobId);
      expect(job.state).to.equal(3); // JobState.Terminal
    });

    it("Should allow client to cancel funded job and refund escrow", async function () {
      await mockUSDC.connect(client).approve(await jobContract.getAddress(), JOB_AMOUNT);
      await jobContract.connect(client).fundJob(jobId);

      const clientBalanceBefore = await mockUSDC.balanceOf(client.address);

      await expect(jobContract.connect(client).cancel(jobId))
        .to.emit(jobContract, "JobCancelled")
        .withArgs(jobId, client.address, JOB_AMOUNT);

      const clientBalanceAfter = await mockUSDC.balanceOf(client.address);
      expect(clientBalanceAfter - clientBalanceBefore).to.equal(JOB_AMOUNT);

      const job = await jobContract.getJob(jobId);
      expect(job.state).to.equal(3); // JobState.Terminal
    });

    it("Should allow evaluator to cancel funded job", async function () {
      await mockUSDC.connect(client).approve(await jobContract.getAddress(), JOB_AMOUNT);
      await jobContract.connect(client).fundJob(jobId);

      await expect(jobContract.connect(evaluator).cancel(jobId))
        .to.emit(jobContract, "JobCancelled")
        .withArgs(jobId, client.address, JOB_AMOUNT);
    });
  });

  describe("Access Control & State Machine Enforcement", function () {
    let jobId;

    beforeEach(async function () {
      await jobContract.connect(client).createJob(provider.address, evaluator.address, JOB_AMOUNT);
      jobId = 0;
    });

    it("Should revert if non-client attempts to fund", async function () {
      await expect(jobContract.connect(stranger).fundJob(jobId))
        .to.be.revertedWithCustomError(jobContract, "Unauthorized")
        .withArgs(stranger.address);
    });

    it("Should revert if non-provider attempts to submit deliverable", async function () {
      await mockUSDC.connect(client).approve(await jobContract.getAddress(), JOB_AMOUNT);
      await jobContract.connect(client).fundJob(jobId);

      await expect(jobContract.connect(stranger).submitDeliverable(jobId, DELIVERABLE_HASH))
        .to.be.revertedWithCustomError(jobContract, "Unauthorized")
        .withArgs(stranger.address);
    });

    it("Should revert if non-evaluator attempts to settle", async function () {
      await mockUSDC.connect(client).approve(await jobContract.getAddress(), JOB_AMOUNT);
      await jobContract.connect(client).fundJob(jobId);
      await jobContract.connect(provider).submitDeliverable(jobId, DELIVERABLE_HASH);

      await expect(jobContract.connect(client).settle(jobId))
        .to.be.revertedWithCustomError(jobContract, "Unauthorized")
        .withArgs(client.address);
    });

    it("Should revert state machine skips (e.g., settling before submission)", async function () {
      await mockUSDC.connect(client).approve(await jobContract.getAddress(), JOB_AMOUNT);
      await jobContract.connect(client).fundJob(jobId);

      // Attempt to settle when state is Funded (1) instead of Submitted (2)
      await expect(jobContract.connect(evaluator).settle(jobId))
        .to.be.revertedWithCustomError(jobContract, "InvalidState")
        .withArgs(jobId, 1, 2);
    });

    it("Should revert cancel on a job already in Terminal state", async function () {
      await jobContract.connect(client).cancel(jobId);

      await expect(jobContract.connect(client).cancel(jobId))
        .to.be.revertedWithCustomError(jobContract, "InvalidState")
        .withArgs(jobId, 3, 0);
    });
  });
});

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("JobContract - Core Business Logic & USDC Escrow", function () {
  let mockUSDC;
  let jobContract;
  let reputationRegistry;
  let owner;
  let client;
  let provider;
  let evaluator;
  let evaluatorModuleSim;
  let stranger;

  const INITIAL_MINT = ethers.parseUnits("1000", 6); // 1,000 USDC
  const JOB_AMOUNT = ethers.parseUnits("100", 6);    // 100 USDC
  const DELIVERABLE_HASH = ethers.keccak256(ethers.toUtf8Bytes("deliverable_result_v1"));

  beforeEach(async function () {
    [owner, client, provider, evaluator, evaluatorModuleSim, stranger] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    // Deploy JobContract
    const JobContract = await ethers.getContractFactory("JobContract");
    jobContract = await JobContract.deploy(await mockUSDC.getAddress());
    await jobContract.waitForDeployment();

    // Deploy ReputationRegistry & configure bidirectional authorization
    const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
    reputationRegistry = await ReputationRegistry.deploy(owner.address);
    await reputationRegistry.waitForDeployment();

    await jobContract.setEvaluatorModule(evaluatorModuleSim.address);
    await jobContract.setReputationRegistry(await reputationRegistry.getAddress());
    await reputationRegistry.setJobContract(await jobContract.getAddress());

    // Mint USDC for client
    await mockUSDC.mint(client.address, INITIAL_MINT);
  });

  describe("Constructor & Zero Input Validations", function () {
    it("Should set the correct USDC address and decimals", async function () {
      expect(await jobContract.usdc()).to.equal(await mockUSDC.getAddress());
      expect(await mockUSDC.decimals()).to.equal(6);
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

    it("Should allow evaluatorModule to settle job, release funds to provider, and increment reputation", async function () {
      await mockUSDC.connect(client).approve(await jobContract.getAddress(), JOB_AMOUNT);
      await jobContract.connect(client).fundJob(jobId);
      await jobContract.connect(provider).submitDeliverable(jobId, DELIVERABLE_HASH);

      const providerInitialBalance = await mockUSDC.balanceOf(provider.address);

      await expect(jobContract.connect(evaluatorModuleSim).settle(jobId))
        .to.emit(jobContract, "JobCompleted")
        .withArgs(jobId, provider.address, JOB_AMOUNT);

      const job = await jobContract.getJob(jobId);
      expect(job.state).to.equal(3); // JobState.Terminal

      const providerFinalBalance = await mockUSDC.balanceOf(provider.address);
      expect(providerFinalBalance - providerInitialBalance).to.equal(JOB_AMOUNT);

      // Verify reputation score incremented
      expect(await reputationRegistry.getReputation(provider.address)).to.equal(1n);

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

    it("Should revert if non-evaluatorModule attempts to settle", async function () {
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
      await expect(jobContract.connect(evaluatorModuleSim).settle(jobId))
        .to.be.revertedWithCustomError(jobContract, "InvalidState")
        .withArgs(jobId, 1, 2);
    });

    it("Should revert cancel on a job already in Terminal state", async function () {
      await jobContract.connect(client).cancel(jobId);

      await expect(jobContract.connect(client).cancel(jobId))
        .to.be.revertedWithCustomError(jobContract, "InvalidState")
        .withArgs(jobId, 3, 0);
    });

    it("Should revert cancel if caller is neither client nor evaluator", async function () {
      await expect(jobContract.connect(stranger).cancel(jobId))
        .to.be.revertedWithCustomError(jobContract, "Unauthorized")
        .withArgs(stranger.address);
    });

    it("Should revert submitDeliverable if deliverableHash is zero bytes", async function () {
      await mockUSDC.connect(client).approve(await jobContract.getAddress(), JOB_AMOUNT);
      await jobContract.connect(client).fundJob(jobId);

      await expect(jobContract.connect(provider).submitDeliverable(jobId, ethers.ZeroHash))
        .to.be.revertedWith("Invalid deliverable hash");
    });
  });

  describe("Timeout Fallback (claimTimeout)", function () {
    let jobId;
    const CUSTOM_TIMEOUT = 20;

    beforeEach(async function () {
      await jobContract
        .connect(client)
        ["createJob(address,address,uint256,uint256)"](provider.address, evaluator.address, JOB_AMOUNT, CUSTOM_TIMEOUT);
      jobId = 0;

      await mockUSDC.connect(client).approve(await jobContract.getAddress(), JOB_AMOUNT);
      await jobContract.connect(client).fundJob(jobId);
      await jobContract.connect(provider).submitDeliverable(jobId, DELIVERABLE_HASH);
    });

    it("Should set job.deadline upon deliverable submission", async function () {
      const job = await jobContract.getJob(jobId);
      expect(job.timeoutBlocks).to.equal(CUSTOM_TIMEOUT);
      expect(job.deadline).to.be.gt(0);
    });

    it("Should revert claimTimeout if deadline has not been reached yet", async function () {
      await expect(jobContract.connect(provider).claimTimeout(jobId))
        .to.be.revertedWithCustomError(jobContract, "TimeoutNotReached");
    });

    it("Should revert claimTimeout if caller is not the provider", async function () {
      await ethers.provider.send("hardhat_mine", [ethers.toBeHex(30)]);

      await expect(jobContract.connect(stranger).claimTimeout(jobId))
        .to.be.revertedWithCustomError(jobContract, "Unauthorized")
        .withArgs(stranger.address);
    });

    it("Should allow provider to claim timeout funds after deadline expires and increment reputation", async function () {
      const providerInitialBalance = await mockUSDC.balanceOf(provider.address);

      // Advance 30 blocks beyond deadline
      await ethers.provider.send("hardhat_mine", [ethers.toBeHex(30)]);

      await expect(jobContract.connect(provider).claimTimeout(jobId))
        .to.emit(jobContract, "JobTimeoutClaimed")
        .withArgs(jobId, provider.address, JOB_AMOUNT)
        .and.to.emit(jobContract, "JobCompleted")
        .withArgs(jobId, provider.address, JOB_AMOUNT);

      const job = await jobContract.getJob(jobId);
      expect(job.state).to.equal(3); // JobState.Terminal

      const providerFinalBalance = await mockUSDC.balanceOf(provider.address);
      expect(providerFinalBalance - providerInitialBalance).to.equal(JOB_AMOUNT);

      // Reputation incremented on timeout claim
      expect(await reputationRegistry.getReputation(provider.address)).to.equal(1n);
    });
  });
});

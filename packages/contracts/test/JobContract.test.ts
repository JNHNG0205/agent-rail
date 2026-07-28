import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toBytes, parseUnits, zeroAddress, zeroHash } from "viem";

describe("JobContract - Core Business Logic & USDC Escrow (Viem)", function () {
  const INITIAL_MINT = parseUnits("1000", 6); // 1,000 USDC
  const JOB_AMOUNT = parseUnits("100", 6);    // 100 USDC
  const DELIVERABLE_HASH = keccak256(toBytes("deliverable_result_v1"));

  async function deployFixture() {
    const [owner, client, provider, evaluator, evaluatorModuleSim, stranger] =
      await hre.viem.getWalletClients();

    const mockUSDC = await hre.viem.deployContract("MockUSDC");
    const jobContract = await hre.viem.deployContract("JobContract", [mockUSDC.address]);
    const reputationRegistry = await hre.viem.deployContract("ReputationRegistry", [
      owner.account.address,
    ]);

    await jobContract.write.setEvaluatorModule([evaluatorModuleSim.account.address]);
    await jobContract.write.setReputationRegistry([reputationRegistry.address]);
    await reputationRegistry.write.setJobContract([jobContract.address]);

    await mockUSDC.write.mint([client.account.address, INITIAL_MINT]);

    // Contract instances scoped to specific callers
    const jobAsClient = await hre.viem.getContractAt("JobContract", jobContract.address, {
      client: { wallet: client },
    });
    const jobAsProvider = await hre.viem.getContractAt("JobContract", jobContract.address, {
      client: { wallet: provider },
    });
    const jobAsEvaluator = await hre.viem.getContractAt("JobContract", jobContract.address, {
      client: { wallet: evaluator },
    });
    const jobAsEvaluatorModule = await hre.viem.getContractAt("JobContract", jobContract.address, {
      client: { wallet: evaluatorModuleSim },
    });
    const jobAsStranger = await hre.viem.getContractAt("JobContract", jobContract.address, {
      client: { wallet: stranger },
    });
    const usdcAsClient = await hre.viem.getContractAt("MockUSDC", mockUSDC.address, {
      client: { wallet: client },
    });

    return {
      mockUSDC,
      jobContract,
      reputationRegistry,
      owner,
      client,
      provider,
      evaluator,
      evaluatorModuleSim,
      stranger,
      jobAsClient,
      jobAsProvider,
      jobAsEvaluator,
      jobAsEvaluatorModule,
      jobAsStranger,
      usdcAsClient,
    };
  }

  describe("Constructor & Zero Input Validations", function () {
    it("Should set the correct USDC address and decimals", async function () {
      const { jobContract, mockUSDC } = await deployFixture();
      expect((await jobContract.read.usdc()).toLowerCase()).to.equal(mockUSDC.address.toLowerCase());
      expect(await mockUSDC.read.decimals()).to.equal(6);
    });

    it("Should revert if deployed with zero address for USDC", async function () {
      await expect(hre.viem.deployContract("JobContract", [zeroAddress])).to.be.rejectedWith(
        "ZeroAddress"
      );
    });

    it("Should revert createJob if provider or evaluator is zero address", async function () {
      const { jobAsClient, evaluator } = await deployFixture();

      await expect(
        jobAsClient.write.createJob([zeroAddress, evaluator.account.address, JOB_AMOUNT])
      ).to.be.rejectedWith("ZeroAddress");
    });

    it("Should revert createJob if amount is zero", async function () {
      const { jobAsClient, provider, evaluator } = await deployFixture();

      await expect(
        jobAsClient.write.createJob([provider.account.address, evaluator.account.address, 0n])
      ).to.be.rejectedWith("ZeroAmount");
    });
  });

  describe("Happy Path Lifecycle (Open -> Funded -> Submitted -> Terminal)", function () {
    it("Should initialize job in Open state", async function () {
      const { jobAsClient, client, provider, evaluator } = await deployFixture();

      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);

      const job = await jobAsClient.read.getJob([0n]);
      expect(job.client.toLowerCase()).to.equal(client.account.address.toLowerCase());
      expect(job.provider.toLowerCase()).to.equal(provider.account.address.toLowerCase());
      expect(job.evaluator.toLowerCase()).to.equal(evaluator.account.address.toLowerCase());
      expect(job.amount).to.equal(JOB_AMOUNT);
      expect(job.state).to.equal(0); // Open
    });

    it("Should fund job and transfer USDC into escrow", async function () {
      const { jobAsClient, usdcAsClient, mockUSDC, jobContract, provider, evaluator } =
        await deployFixture();

      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);
      await usdcAsClient.write.approve([jobContract.address, JOB_AMOUNT]);
      await jobAsClient.write.fundJob([0n]);

      const job = await jobContract.read.getJob([0n]);
      expect(job.state).to.equal(1); // Funded

      const escrowBalance = await mockUSDC.read.balanceOf([jobContract.address]);
      expect(escrowBalance).to.equal(JOB_AMOUNT);
    });

    it("Should allow provider to submit deliverable", async function () {
      const { jobAsClient, jobAsProvider, usdcAsClient, jobContract, provider, evaluator } =
        await deployFixture();

      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);
      await usdcAsClient.write.approve([jobContract.address, JOB_AMOUNT]);
      await jobAsClient.write.fundJob([0n]);

      await jobAsProvider.write.submitDeliverable([0n, DELIVERABLE_HASH]);

      const job = await jobContract.read.getJob([0n]);
      expect(job.state).to.equal(2); // Submitted
      expect(job.deliverableHash).to.equal(DELIVERABLE_HASH);
    });

    it("Should allow evaluatorModule to settle job, release funds to provider, and increment reputation", async function () {
      const {
        jobAsClient,
        jobAsProvider,
        jobAsEvaluatorModule,
        usdcAsClient,
        jobContract,
        mockUSDC,
        reputationRegistry,
        provider,
        evaluator,
      } = await deployFixture();

      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);
      await usdcAsClient.write.approve([jobContract.address, JOB_AMOUNT]);
      await jobAsClient.write.fundJob([0n]);
      await jobAsProvider.write.submitDeliverable([0n, DELIVERABLE_HASH]);

      const providerInitialBalance = await mockUSDC.read.balanceOf([provider.account.address]);

      await jobAsEvaluatorModule.write.settle([0n]);

      const job = await jobContract.read.getJob([0n]);
      expect(job.state).to.equal(3); // Terminal

      const providerFinalBalance = await mockUSDC.read.balanceOf([provider.account.address]);
      expect(providerFinalBalance - providerInitialBalance).to.equal(JOB_AMOUNT);

      expect(await reputationRegistry.read.getReputation([provider.account.address])).to.equal(1n);
    });
  });

  describe("Cancellation Path", function () {
    it("Should allow client to cancel unfunded job", async function () {
      const { jobAsClient, jobContract, provider, evaluator } = await deployFixture();

      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);
      await jobAsClient.write.cancel([0n]);

      const job = await jobContract.read.getJob([0n]);
      expect(job.state).to.equal(3); // Terminal
    });

    it("Should allow client to cancel funded job and refund escrow", async function () {
      const { jobAsClient, usdcAsClient, jobContract, mockUSDC, client, provider, evaluator } =
        await deployFixture();

      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);
      await usdcAsClient.write.approve([jobContract.address, JOB_AMOUNT]);
      await jobAsClient.write.fundJob([0n]);

      const clientBalanceBefore = await mockUSDC.read.balanceOf([client.account.address]);

      await jobAsClient.write.cancel([0n]);

      const clientBalanceAfter = await mockUSDC.read.balanceOf([client.account.address]);
      expect(clientBalanceAfter - clientBalanceBefore).to.equal(JOB_AMOUNT);

      const job = await jobContract.read.getJob([0n]);
      expect(job.state).to.equal(3); // Terminal
    });

    it("Should revert if client attempts to cancel a Submitted job directly", async function () {
      const { jobAsClient, jobAsProvider, usdcAsClient, jobContract, provider, evaluator } =
        await deployFixture();

      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);
      await usdcAsClient.write.approve([jobContract.address, JOB_AMOUNT]);
      await jobAsClient.write.fundJob([0n]);
      await jobAsProvider.write.submitDeliverable([0n, DELIVERABLE_HASH]);

      await expect(jobAsClient.write.cancel([0n])).to.be.rejectedWith("Unauthorized");
    });
  });
});

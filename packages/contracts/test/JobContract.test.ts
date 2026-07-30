import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toBytes, parseUnits, zeroAddress, zeroHash } from "viem";

type JobStruct = {
  client: string;
  provider: string;
  evaluator: string;
  amount: bigint;
  state: number;
  deliverableHash: string;
  timeoutBlocks: bigint;
  deadline: bigint;
};

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
      expect(((await jobContract.read.usdc()) as string).toLowerCase()).to.equal(mockUSDC.address.toLowerCase());
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

      const job = (await jobAsClient.read.getJob([0n])) as JobStruct;
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

      const job = (await jobContract.read.getJob([0n])) as JobStruct;
      expect(job.state).to.equal(1); // Funded

      const escrowBalance = (await mockUSDC.read.balanceOf([jobContract.address])) as bigint;
      expect(escrowBalance).to.equal(JOB_AMOUNT);
    });

    it("Should allow provider to submit deliverable", async function () {
      const { jobAsClient, jobAsProvider, usdcAsClient, jobContract, provider, evaluator } =
        await deployFixture();

      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);
      await usdcAsClient.write.approve([jobContract.address, JOB_AMOUNT]);
      await jobAsClient.write.fundJob([0n]);

      await jobAsProvider.write.submitDeliverable([0n, DELIVERABLE_HASH]);

      const job = (await jobContract.read.getJob([0n])) as JobStruct;
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

      const providerInitialBalance = (await mockUSDC.read.balanceOf([provider.account.address])) as bigint;

      await jobAsEvaluatorModule.write.settle([0n]);

      const job = (await jobContract.read.getJob([0n])) as JobStruct;
      expect(job.state).to.equal(3); // Terminal

      const providerFinalBalance = (await mockUSDC.read.balanceOf([provider.account.address])) as bigint;
      expect(providerFinalBalance - providerInitialBalance).to.equal(JOB_AMOUNT);

      expect(await reputationRegistry.read.getReputation([provider.account.address])).to.equal(1n);
    });
  });

  describe("Cancellation Path", function () {
    it("Should allow client to cancel unfunded job", async function () {
      const { jobAsClient, jobContract, provider, evaluator } = await deployFixture();

      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);
      await jobAsClient.write.cancel([0n]);

      const job = (await jobContract.read.getJob([0n])) as JobStruct;
      expect(job.state).to.equal(3); // Terminal
    });

    it("Should allow client to cancel funded job and refund escrow", async function () {
      const { jobAsClient, usdcAsClient, jobContract, mockUSDC, client, provider, evaluator } =
        await deployFixture();

      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);
      await usdcAsClient.write.approve([jobContract.address, JOB_AMOUNT]);
      await jobAsClient.write.fundJob([0n]);

      const clientBalanceBefore = (await mockUSDC.read.balanceOf([client.account.address])) as bigint;

      await jobAsClient.write.cancel([0n]);

      const clientBalanceAfter = (await mockUSDC.read.balanceOf([client.account.address])) as bigint;
      expect(clientBalanceAfter - clientBalanceBefore).to.equal(JOB_AMOUNT);

      const job = (await jobContract.read.getJob([0n])) as JobStruct;
      expect(job.state).to.equal(3); // Terminal
    });

    it("Should revert if client attempts to cancel a Submitted job directly", async function () {
      const { jobAsClient, jobAsProvider, usdcAsClient, provider, evaluator } =
        await deployFixture();

      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);
      await usdcAsClient.write.approve([jobAsClient.address, JOB_AMOUNT]);
      await jobAsClient.write.fundJob([0n]);
      await jobAsProvider.write.submitDeliverable([0n, DELIVERABLE_HASH]);

      await expect(jobAsClient.write.cancel([0n])).to.be.rejectedWith("Unauthorized");
    });

    it("Should allow evaluator to cancel an Open or Funded job", async function () {
      const { jobAsClient, jobAsEvaluator, usdcAsClient, jobContract, mockUSDC, client, provider, evaluator } =
        await deployFixture();

      // Open job cancel by evaluator
      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);
      await jobAsEvaluator.write.cancel([0n]);
      expect(((await jobContract.read.getJob([0n])) as JobStruct).state).to.equal(3); // Terminal

      // Funded job cancel by evaluator
      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);
      await usdcAsClient.write.approve([jobContract.address, JOB_AMOUNT]);
      await jobAsClient.write.fundJob([1n]);

      const clientBalanceBefore = (await mockUSDC.read.balanceOf([client.account.address])) as bigint;
      await jobAsEvaluator.write.cancel([1n]);
      const clientBalanceAfter = (await mockUSDC.read.balanceOf([client.account.address])) as bigint;

      expect(clientBalanceAfter - clientBalanceBefore).to.equal(JOB_AMOUNT);
      expect(((await jobContract.read.getJob([1n])) as JobStruct).state).to.equal(3); // Terminal
    });

    it("Should allow evaluatorModule to cancel a Submitted job (rejection path)", async function () {
      const { jobAsClient, jobAsProvider, jobAsEvaluatorModule, usdcAsClient, jobContract, mockUSDC, client, provider, evaluator } =
        await deployFixture();

      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);
      await usdcAsClient.write.approve([jobContract.address, JOB_AMOUNT]);
      await jobAsClient.write.fundJob([0n]);
      await jobAsProvider.write.submitDeliverable([0n, DELIVERABLE_HASH]);

      const clientBalanceBefore = (await mockUSDC.read.balanceOf([client.account.address])) as bigint;
      await jobAsEvaluatorModule.write.cancel([0n]);
      const clientBalanceAfter = (await mockUSDC.read.balanceOf([client.account.address])) as bigint;

      expect(clientBalanceAfter - clientBalanceBefore).to.equal(JOB_AMOUNT);
      expect(((await jobContract.read.getJob([0n])) as JobStruct).state).to.equal(3); // Terminal
    });

    it("Should revert cancel if called by stranger or evaluator on Submitted job, or on already Terminal job", async function () {
      const { jobAsClient, jobAsProvider, jobAsEvaluator, jobAsStranger, usdcAsClient, jobContract, provider, evaluator } =
        await deployFixture();

      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);

      // Stranger on Open job
      await expect(jobAsStranger.write.cancel([0n])).to.be.rejectedWith("Unauthorized");

      // Evaluator on Submitted job
      await usdcAsClient.write.approve([jobContract.address, JOB_AMOUNT]);
      await jobAsClient.write.fundJob([0n]);
      await jobAsProvider.write.submitDeliverable([0n, DELIVERABLE_HASH]);
      await expect(jobAsEvaluator.write.cancel([0n])).to.be.rejectedWith("Unauthorized");

      // Already Terminal job cancel (evaluatorModule cancels it first to make it Terminal, then client tries to cancel)
      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);
      await jobAsClient.write.cancel([1n]);
      await expect(jobAsClient.write.cancel([1n])).to.be.rejectedWith("InvalidState");
    });
  });

  describe("Admin Setters & Custom Parameters", function () {
    it("Should revert setEvaluatorModule if caller is not owner or address is zero", async function () {
      const { jobContract, jobAsStranger, evaluator } = await deployFixture();

      await expect(
        jobAsStranger.write.setEvaluatorModule([evaluator.account.address])
      ).to.be.rejectedWith("Unauthorized");

      await expect(
        jobContract.write.setEvaluatorModule([zeroAddress])
      ).to.be.rejectedWith("ZeroAddress");
    });

    it("Should revert setReputationRegistry if caller is not owner or address is zero", async function () {
      const { jobContract, jobAsStranger, evaluator } = await deployFixture();

      await expect(
        jobAsStranger.write.setReputationRegistry([evaluator.account.address])
      ).to.be.rejectedWith("Unauthorized");

      await expect(
        jobContract.write.setReputationRegistry([zeroAddress])
      ).to.be.rejectedWith("ZeroAddress");
    });

    it("Should support custom timeoutBlocks and default timeout fallback", async function () {
      const { jobAsClient, provider, evaluator } = await deployFixture();

      // Custom timeout 50 blocks
      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT, 50n]);
      const job0 = (await jobAsClient.read.getJob([0n])) as JobStruct;
      expect(job0.timeoutBlocks).to.equal(50n);

      // Explicit 0 timeout fallback to DEFAULT_TIMEOUT_BLOCKS (100)
      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT, 0n]);
      const job1 = (await jobAsClient.read.getJob([1n])) as JobStruct;
      expect(job1.timeoutBlocks).to.equal(100n);
    });

    it("Should validate modifiers (onlyClient, onlyProvider, onlyEvaluatorModule), zero hash, and job state", async function () {
      const { jobAsClient, jobAsProvider, jobAsStranger, usdcAsClient, jobContract, provider, evaluator } =
        await deployFixture();

      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);

      // Stranger calling fundJob -> onlyClient revert Unauthorized
      await expect(jobAsStranger.write.fundJob([0n])).to.be.rejectedWith("Unauthorized");

      // Submit deliverable on Open (unfunded) job -> InvalidState
      await expect(
        jobAsProvider.write.submitDeliverable([0n, DELIVERABLE_HASH])
      ).to.be.rejectedWith("InvalidState");

      // Fund job properly
      await usdcAsClient.write.approve([jobContract.address, JOB_AMOUNT]);
      await jobAsClient.write.fundJob([0n]);

      // Stranger submit deliverable on Funded job -> onlyProvider revert Unauthorized
      await expect(
        jobAsStranger.write.submitDeliverable([0n, DELIVERABLE_HASH])
      ).to.be.rejectedWith("Unauthorized");

      // Zero deliverable hash -> Invalid deliverable hash
      await expect(
        jobAsProvider.write.submitDeliverable([0n, zeroHash])
      ).to.be.rejectedWith("Invalid deliverable hash");

      // Submit deliverable properly
      await jobAsProvider.write.submitDeliverable([0n, DELIVERABLE_HASH]);

      // Stranger calling settle on Submitted job -> onlyEvaluatorModule revert Unauthorized
      await expect(jobAsStranger.write.settle([0n])).to.be.rejectedWith("Unauthorized");
    });
  });

  describe("Timeout Claiming (claimTimeout)", function () {
    it("Should revert claimTimeout if called by non-provider or before deadline", async function () {
      const { jobAsClient, jobAsProvider, jobAsStranger, usdcAsClient, jobContract, provider, evaluator } =
        await deployFixture();

      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT]);
      await usdcAsClient.write.approve([jobContract.address, JOB_AMOUNT]);
      await jobAsClient.write.fundJob([0n]);
      await jobAsProvider.write.submitDeliverable([0n, DELIVERABLE_HASH]);

      // Stranger calling claimTimeout -> Unauthorized
      await expect(jobAsStranger.write.claimTimeout([0n])).to.be.rejectedWith("Unauthorized");

      // Provider calling claimTimeout before deadline -> TimeoutNotReached
      await expect(jobAsProvider.write.claimTimeout([0n])).to.be.rejectedWith("TimeoutNotReached");
    });

    it("Should allow provider to claim escrow after timeout deadline passes", async function () {
      const { jobAsClient, jobAsProvider, usdcAsClient, jobContract, mockUSDC, reputationRegistry, provider, evaluator } =
        await deployFixture();

      await jobAsClient.write.createJob([provider.account.address, evaluator.account.address, JOB_AMOUNT, 10n]);
      await usdcAsClient.write.approve([jobContract.address, JOB_AMOUNT]);
      await jobAsClient.write.fundJob([0n]);
      await jobAsProvider.write.submitDeliverable([0n, DELIVERABLE_HASH]);

      // Mine 11 blocks past deadline
      await hre.network.provider.send("hardhat_mine", ["0x0B"]);

      const providerBalanceBefore = (await mockUSDC.read.balanceOf([provider.account.address])) as bigint;
      await jobAsProvider.write.claimTimeout([0n]);
      const providerBalanceAfter = (await mockUSDC.read.balanceOf([provider.account.address])) as bigint;

      expect(providerBalanceAfter - providerBalanceBefore).to.equal(JOB_AMOUNT);

      const job = (await jobContract.read.getJob([0n])) as JobStruct;
      expect(job.state).to.equal(3); // Terminal

      expect(await reputationRegistry.read.getReputation([provider.account.address])).to.equal(1n);
    });
  });
});

describe("JobContract — identity gating", function () {
  async function fixture() {
    const [owner, client, provider, evaluator] = await hre.viem.getWalletClients();
    const usdc = await hre.viem.deployContract("MockUSDC");
    const job = await hre.viem.deployContract("JobContract", [usdc.address]);
    const identity = await hre.viem.deployContract("IdentityRegistry");
    return { usdc, job, identity, owner, client, provider, evaluator };
  }

  const AMOUNT = 10n * 10n ** 6n;

  it("permits any address while no registry is wired", async function () {
    // Backwards compatibility: a deployment that never calls
    // setIdentityRegistry keeps the previous permissionless behaviour.
    const { job, client, provider, evaluator } = await fixture();

    await job.write.createJob([provider.account.address, evaluator.account.address, AMOUNT], {
      account: client.account,
    });

    expect(await job.read.nextJobId()).to.equal(1n);
  });

  it("reverts NotRegistered for an unregistered provider once wired", async function () {
    const { job, identity, client, provider, evaluator } = await fixture();
    await job.write.setIdentityRegistry([identity.address]);
    await identity.write.registerAgent([client.account.address]);
    await identity.write.registerAgent([evaluator.account.address]);
    // provider deliberately left unregistered

    await expect(
      job.write.createJob([provider.account.address, evaluator.account.address, AMOUNT], {
        account: client.account,
      })
    ).to.be.rejectedWith("NotRegistered");
  });

  it("reverts NotRegistered for an unregistered evaluator once wired", async function () {
    const { job, identity, client, provider, evaluator } = await fixture();
    await job.write.setIdentityRegistry([identity.address]);
    await identity.write.registerAgent([client.account.address]);
    await identity.write.registerAgent([provider.account.address]);

    await expect(
      job.write.createJob([provider.account.address, evaluator.account.address, AMOUNT], {
        account: client.account,
      })
    ).to.be.rejectedWith("NotRegistered");
  });

  it("reverts NotRegistered for an unregistered client once wired", async function () {
    const { job, identity, client, provider, evaluator } = await fixture();
    await job.write.setIdentityRegistry([identity.address]);
    await identity.write.registerAgent([provider.account.address]);
    await identity.write.registerAgent([evaluator.account.address]);

    await expect(
      job.write.createJob([provider.account.address, evaluator.account.address, AMOUNT], {
        account: client.account,
      })
    ).to.be.rejectedWith("NotRegistered");
  });

  it("creates the job when all three parties hold identity tokens", async function () {
    const { job, identity, client, provider, evaluator } = await fixture();
    await job.write.setIdentityRegistry([identity.address]);
    for (const a of [client, provider, evaluator]) {
      await identity.write.registerAgent([a.account.address]);
    }

    await job.write.createJob([provider.account.address, evaluator.account.address, AMOUNT], {
      account: client.account,
    });

    const created = await job.read.getJob([0n]);
    expect(created.state).to.equal(0);
    expect((created.evaluator as string).toLowerCase()).to.equal(
      evaluator.account.address.toLowerCase()
    );
  });

  it("only the owner may set the identity registry", async function () {
    const { job, identity, client } = await fixture();
    await expect(
      job.write.setIdentityRegistry([identity.address], { account: client.account })
    ).to.be.rejectedWith("Unauthorized");
  });
});

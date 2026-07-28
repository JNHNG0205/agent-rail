const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgentRail - End-to-End Multi-Contract System Integration", function () {
  let mockUSDC;
  let jobContract;
  let identityRegistry;
  let reputationRegistry;
  let evaluatorModule;

  let owner;
  let clientAgent;
  let providerAgent;
  let evaluatorAgent;

  const JOB_AMOUNT = ethers.parseUnits("100", 6); // 100 USDC
  const DELIVERABLE_TEXT = "AI Task Completion Report - Summary Data";
  const DELIVERABLE_HASH = ethers.keccak256(ethers.toUtf8Bytes(DELIVERABLE_TEXT));

  beforeEach(async function () {
    [owner, clientAgent, providerAgent, evaluatorAgent] = await ethers.getSigners();

    // 1. Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    // 2. Deploy JobContract
    const JobContract = await ethers.getContractFactory("JobContract");
    jobContract = await JobContract.deploy(await mockUSDC.getAddress());
    await jobContract.waitForDeployment();

    // 3. Deploy IdentityRegistry
    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy();
    await identityRegistry.waitForDeployment();

    // 4. Deploy ReputationRegistry
    const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
    reputationRegistry = await ReputationRegistry.deploy(owner.address);
    await reputationRegistry.waitForDeployment();

    // 5. Deploy EvaluatorModule
    const EvaluatorModule = await ethers.getContractFactory("EvaluatorModule");
    evaluatorModule = await EvaluatorModule.deploy(await jobContract.getAddress());
    await evaluatorModule.waitForDeployment();

    // 6. Connect Cross-Contract Permissions
    await jobContract.setEvaluatorModule(await evaluatorModule.getAddress());
    await jobContract.setReputationRegistry(await reputationRegistry.getAddress());
    await reputationRegistry.setJobContract(await jobContract.getAddress());

    // Fund Client with USDC
    await mockUSDC.mint(clientAgent.address, ethers.parseUnits("1000", 6));
  });

  it("Executes the complete 3-Agent payment settlement lifecycle across all 5 contracts", async function () {
    // -------------------------------------------------------------
    // Step 1: Agent Registration (IdentityRegistry - ERC-8004 NFT)
    // -------------------------------------------------------------
    await identityRegistry.registerAgent(clientAgent.address);
    await identityRegistry.registerAgent(providerAgent.address);
    await identityRegistry.registerAgent(evaluatorAgent.address);

    expect(await identityRegistry.isRegistered(clientAgent.address)).to.equal(true);
    expect(await identityRegistry.isRegistered(providerAgent.address)).to.equal(true);
    expect(await identityRegistry.isRegistered(evaluatorAgent.address)).to.equal(true);

    const clientTokenId = await identityRegistry.getAgentId(clientAgent.address);
    const providerTokenId = await identityRegistry.getAgentId(providerAgent.address);
    const evaluatorTokenId = await identityRegistry.getAgentId(evaluatorAgent.address);

    expect(clientTokenId).to.equal(0n);
    expect(providerTokenId).to.equal(1n);
    expect(evaluatorTokenId).to.equal(2n);

    // -------------------------------------------------------------
    // Step 2: Create Escrow Job (JobContract)
    // -------------------------------------------------------------
    const createTx = await jobContract
      .connect(clientAgent)
      .createJob(providerAgent.address, evaluatorAgent.address, JOB_AMOUNT);
    await createTx.wait();

    const jobId = 0n;
    let job = await jobContract.getJob(jobId);
    expect(job.client).to.equal(clientAgent.address);
    expect(job.provider).to.equal(providerAgent.address);
    expect(job.evaluator).to.equal(evaluatorAgent.address);
    expect(job.state).to.equal(0); // JobState.Open

    // -------------------------------------------------------------
    // Step 3: Fund Job into Escrow (MockUSDC -> JobContract)
    // -------------------------------------------------------------
    await mockUSDC.connect(clientAgent).approve(await jobContract.getAddress(), JOB_AMOUNT);
    await jobContract.connect(clientAgent).fundJob(jobId);

    job = await jobContract.getJob(jobId);
    expect(job.state).to.equal(1); // JobState.Funded
    expect(await mockUSDC.balanceOf(await jobContract.getAddress())).to.equal(JOB_AMOUNT);

    // -------------------------------------------------------------
    // Step 4: Provider Submits Deliverable (JobContract)
    // -------------------------------------------------------------
    await jobContract.connect(providerAgent).submitDeliverable(jobId, DELIVERABLE_HASH);

    job = await jobContract.getJob(jobId);
    expect(job.state).to.equal(2); // JobState.Submitted
    expect(job.deliverableHash).to.equal(DELIVERABLE_HASH);

    // -------------------------------------------------------------
    // Step 5: Evaluator Signs Approval Off-Chain (EIP-191 ECDSA)
    // -------------------------------------------------------------
    const messageHash = ethers.solidityPackedKeccak256(
      ["uint256", "bytes32", "bool"],
      [jobId, DELIVERABLE_HASH, true]
    );

    // Sign message as Evaluator
    const signature = await evaluatorAgent.signMessage(ethers.getBytes(messageHash));

    // -------------------------------------------------------------
    // Step 6: Submit Signature to EvaluatorModule -> JobContract -> ReputationRegistry
    // -------------------------------------------------------------
    const providerBalanceBefore = await mockUSDC.balanceOf(providerAgent.address);

    await expect(evaluatorModule.submitApproval(jobId, DELIVERABLE_HASH, true, signature))
      .to.emit(evaluatorModule, "ApprovalProcessed")
      .withArgs(jobId, evaluatorAgent.address, true)
      .and.to.emit(jobContract, "JobCompleted")
      .withArgs(jobId, providerAgent.address, JOB_AMOUNT)
      .and.to.emit(reputationRegistry, "ReputationUpdated")
      .withArgs(providerAgent.address, 1n);

    // -------------------------------------------------------------
    // Step 7: Verify Final State Across All Contracts
    // -------------------------------------------------------------
    // JobContract state is Terminal
    job = await jobContract.getJob(jobId);
    expect(job.state).to.equal(3); // JobState.Terminal

    // Escrow emptied and USDC paid to Provider
    const providerBalanceAfter = await mockUSDC.balanceOf(providerAgent.address);
    expect(providerBalanceAfter - providerBalanceBefore).to.equal(JOB_AMOUNT);
    expect(await mockUSDC.balanceOf(await jobContract.getAddress())).to.equal(0n);

    // Provider Reputation score incremented to 1
    expect(await reputationRegistry.getReputation(providerAgent.address)).to.equal(1n);

    // Client reputation remains 0
    expect(await reputationRegistry.getReputation(clientAgent.address)).to.equal(0n);
  });
});

import { expect } from "chai";
import hre from "hardhat";
import { keccak256, encodePacked, parseUnits, toBytes } from "viem";

describe("AgentRail - End-to-End Multi-Contract System Integration (Viem)", function () {
  const JOB_AMOUNT = parseUnits("100", 6); // 100 USDC
  const DELIVERABLE_TEXT = "AI Task Completion Report - Summary Data";
  const DELIVERABLE_HASH = keccak256(toBytes(DELIVERABLE_TEXT));

  it("Executes the complete 3-Agent payment settlement lifecycle across all 5 contracts using Viem", async function () {
    const [owner, clientAgent, providerAgent, evaluatorAgent] = await hre.viem.getWalletClients();

    // 1. Deploy Contracts
    const mockUSDC = await hre.viem.deployContract("MockUSDC");
    const jobContract = await hre.viem.deployContract("JobContract", [mockUSDC.address]);
    const identityRegistry = await hre.viem.deployContract("IdentityRegistry");
    const reputationRegistry = await hre.viem.deployContract("ReputationRegistry", [
      owner.account.address,
    ]);
    const evaluatorModule = await hre.viem.deployContract("EvaluatorModule", [
      jobContract.address,
    ]);

    // 2. Wire Permissions
    await jobContract.write.setEvaluatorModule([evaluatorModule.address]);
    await jobContract.write.setReputationRegistry([reputationRegistry.address]);
    await reputationRegistry.write.setJobContract([jobContract.address]);

    // 3. Fund Client Agent with USDC
    await mockUSDC.write.mint([clientAgent.account.address, parseUnits("1000", 6)]);

    // 4. Contract Client Wrappers
    const jobAsClient = await hre.viem.getContractAt("JobContract", jobContract.address, {
      client: { wallet: clientAgent },
    });
    const jobAsProvider = await hre.viem.getContractAt("JobContract", jobContract.address, {
      client: { wallet: providerAgent },
    });
    const usdcAsClient = await hre.viem.getContractAt("MockUSDC", mockUSDC.address, {
      client: { wallet: clientAgent },
    });

    // -------------------------------------------------------------
    // Step 1: Agent Registration (IdentityRegistry - ERC-8004 NFT)
    // -------------------------------------------------------------
    await identityRegistry.write.registerAgent([clientAgent.account.address]);
    await identityRegistry.write.registerAgent([providerAgent.account.address]);
    await identityRegistry.write.registerAgent([evaluatorAgent.account.address]);

    expect(await identityRegistry.read.isRegistered([clientAgent.account.address])).to.equal(true);
    expect(await identityRegistry.read.isRegistered([providerAgent.account.address])).to.equal(true);
    expect(await identityRegistry.read.isRegistered([evaluatorAgent.account.address])).to.equal(true);

    expect(await identityRegistry.read.getAgentId([clientAgent.account.address])).to.equal(0n);
    expect(await identityRegistry.read.getAgentId([providerAgent.account.address])).to.equal(1n);
    expect(await identityRegistry.read.getAgentId([evaluatorAgent.account.address])).to.equal(2n);

    // -------------------------------------------------------------
    // Step 2: Create Escrow Job (JobContract)
    // -------------------------------------------------------------
    await jobAsClient.write.createJob([
      providerAgent.account.address,
      evaluatorAgent.account.address,
      JOB_AMOUNT,
    ]);

    const jobId = 0n;
    let job = await jobContract.read.getJob([jobId]);
    expect(job.client.toLowerCase()).to.equal(clientAgent.account.address.toLowerCase());
    expect(job.provider.toLowerCase()).to.equal(providerAgent.account.address.toLowerCase());
    expect(job.evaluator.toLowerCase()).to.equal(evaluatorAgent.account.address.toLowerCase());
    expect(job.state).to.equal(0); // JobState.Open

    // -------------------------------------------------------------
    // Step 3: Fund Job into Escrow (MockUSDC -> JobContract)
    // -------------------------------------------------------------
    await usdcAsClient.write.approve([jobContract.address, JOB_AMOUNT]);
    await jobAsClient.write.fundJob([jobId]);

    job = await jobContract.read.getJob([jobId]);
    expect(job.state).to.equal(1); // JobState.Funded
    expect(await mockUSDC.read.balanceOf([jobContract.address])).to.equal(JOB_AMOUNT);

    // -------------------------------------------------------------
    // Step 4: Provider Submits Deliverable (JobContract)
    // -------------------------------------------------------------
    await jobAsProvider.write.submitDeliverable([jobId, DELIVERABLE_HASH]);

    job = await jobContract.read.getJob([jobId]);
    expect(job.state).to.equal(2); // JobState.Submitted
    expect(job.deliverableHash).to.equal(DELIVERABLE_HASH);

    // -------------------------------------------------------------
    // Step 5: Evaluator Signs Approval Off-Chain (EIP-191 ECDSA)
    // -------------------------------------------------------------
    const messageHash = keccak256(
      encodePacked(["uint256", "bytes32", "bool"], [jobId, DELIVERABLE_HASH, true])
    );

    const signature = await evaluatorAgent.signMessage({
      message: { raw: messageHash },
    });

    // -------------------------------------------------------------
    // Step 6: Submit Signature to EvaluatorModule -> JobContract -> ReputationRegistry
    // -------------------------------------------------------------
    const providerBalanceBefore = await mockUSDC.read.balanceOf([providerAgent.account.address]);

    await evaluatorModule.write.submitApproval([jobId, DELIVERABLE_HASH, true, signature]);

    // -------------------------------------------------------------
    // Step 7: Verify Final State Across All Contracts
    // -------------------------------------------------------------
    // JobContract state is Terminal
    job = await jobContract.read.getJob([jobId]);
    expect(job.state).to.equal(3); // JobState.Terminal

    // Escrow emptied and USDC paid to Provider
    const providerBalanceAfter = await mockUSDC.read.balanceOf([providerAgent.account.address]);
    expect(providerBalanceAfter - providerBalanceBefore).to.equal(JOB_AMOUNT);
    expect(await mockUSDC.read.balanceOf([jobContract.address])).to.equal(0n);

    // Provider Reputation score incremented to 1
    expect(await reputationRegistry.read.getReputation([providerAgent.account.address])).to.equal(1n);

    // Client reputation remains 0
    expect(await reputationRegistry.read.getReputation([clientAgent.account.address])).to.equal(0n);
  });
});

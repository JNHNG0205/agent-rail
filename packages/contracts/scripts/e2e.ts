import hre from "hardhat";
import { keccak256, encodePacked, toBytes } from "viem";
import {
  getAddresses,
  JobContractAbi,
  EvaluatorModuleAbi,
  MockUSDCAbi,
  ReputationRegistryAbi,
  agentLabel,
  formatUsdc,
} from "@agentrail/shared";

/// Full hire -> settle flow driven entirely through the regenerated shared
/// ABIs, the way the agent processes will do it. Proves the ABIs match the
/// deployed contracts and pins the exact EIP-191 digest approve.ts must build.
async function main() {
  const pub = await hre.viem.getPublicClient();
  const a = getAddresses(await pub.getChainId());
  const [clientW, providerW, evaluatorW] = await hre.viem.getWalletClients();

  const client = clientW.account.address;
  const provider = providerW.account.address;
  const evaluator = evaluatorW.account.address;
  const amount = 100n * 10n ** 6n;

  console.log("client   ", agentLabel(client));
  console.log("provider ", agentLabel(provider));
  console.log("evaluator", agentLabel(evaluator));

  // 1. Agent A creates the job, naming Agent C as evaluator.
  let hash = await clientW.writeContract({
    address: a.JobContract, abi: JobContractAbi, functionName: "createJob",
    args: [provider, evaluator, amount],
  });
  const createRcpt = await pub.waitForTransactionReceipt({ hash });
  const created = await pub.getContractEvents({
    address: a.JobContract, abi: JobContractAbi, eventName: "JobCreated",
    blockHash: createRcpt.blockHash,
  });
  const jobId = created[0]!.args.jobId!;
  console.log(`JobCreated       jobId=${jobId} evaluator=${created[0]!.args.evaluator}`);

  // 2. Agent A approves and funds the escrow.
  hash = await clientW.writeContract({
    address: a.MockUSDC, abi: MockUSDCAbi, functionName: "approve",
    args: [a.JobContract, amount],
  });
  await pub.waitForTransactionReceipt({ hash });
  hash = await clientW.writeContract({
    address: a.JobContract, abi: JobContractAbi, functionName: "fundJob", args: [jobId],
  });
  await pub.waitForTransactionReceipt({ hash });
  const escrow = await pub.readContract({
    address: a.MockUSDC, abi: MockUSDCAbi, functionName: "balanceOf", args: [a.JobContract],
  });
  console.log(`JobFunded        escrow=${formatUsdc(escrow as bigint)} USDC`);

  // 3. Agent B submits the deliverable hash.
  const deliverable = "<svg xmlns='http://www.w3.org/2000/svg'><text>poster</text></svg>";
  const deliverableHash = keccak256(toBytes(deliverable));
  hash = await providerW.writeContract({
    address: a.JobContract, abi: JobContractAbi, functionName: "submitDeliverable",
    args: [jobId, deliverableHash],
  });
  await pub.waitForTransactionReceipt({ hash });
  console.log(`DeliverableSubmitted hash=${deliverableHash.slice(0, 18)}…`);

  // 4. Agent C signs the approval off-chain. This is the digest approve.ts
  //    must reproduce byte-for-byte: EIP-191 over abi.encodePacked.
  const approved = true;
  const digest = keccak256(
    encodePacked(["uint256", "bytes32", "bool"], [jobId, deliverableHash, approved]),
  );
  const signature = await evaluatorW.signMessage({ message: { raw: digest } });

  // 5. Anyone may submit; the signature is the authorisation.
  const before = (await pub.readContract({
    address: a.MockUSDC, abi: MockUSDCAbi, functionName: "balanceOf", args: [provider],
  })) as bigint;
  hash = await evaluatorW.writeContract({
    address: a.EvaluatorModule, abi: EvaluatorModuleAbi, functionName: "submitApproval",
    args: [jobId, deliverableHash, approved, signature],
  });
  await pub.waitForTransactionReceipt({ hash });

  const after = (await pub.readContract({
    address: a.MockUSDC, abi: MockUSDCAbi, functionName: "balanceOf", args: [provider],
  })) as bigint;
  const job = (await pub.readContract({
    address: a.JobContract, abi: JobContractAbi, functionName: "getJob", args: [jobId],
  })) as { state: number };
  const rep = await pub.readContract({
    address: a.ReputationRegistry, abi: ReputationRegistryAbi,
    functionName: "getReputation", args: [provider],
  });

  console.log(`ApprovalProcessed  paid=${formatUsdc(after - before)} USDC`);
  console.log(`final state        ${job.state} (3 = Terminal)`);
  console.log(`provider reputation ${rep}`);
}

main().catch((e) => { console.error("FAILED:", e.shortMessage ?? e.message); process.exit(1); });

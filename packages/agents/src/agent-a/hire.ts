import { parseEventLogs } from "viem";
import {
  addresses,
  JobContractAbi,
  MockUSDCAbi,
  formatUsdc,
  CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  type PosterBrief,
} from "@agentrail/shared";
import { publicClient, agentA } from "../lib/wallet.js";
import { composeBrief } from "./llm.js";
import { waitForAllowance, fundWithRetry } from "./fund.js";

export interface QuoteResponse {
  price: string; // USDC minor units, as string
  provider: `0x${string}`;
  contract: `0x${string}`;
  service: string;
  description: string;
  requirements: string[];
}

export interface HireResult {
  jobId: bigint;
  brief: PosterBrief;
  quote: QuoteResponse;
}

function isQuote(value: unknown): value is QuoteResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.price === "string" &&
    typeof v.provider === "string" &&
    Array.isArray(v.requirements) &&
    v.requirements.every((r) => typeof r === "string")
  );
}

/// Address of the evaluator this client assigns. Per ACP the client chooses the
/// evaluator, so it is Agent A's configuration rather than the provider's. Only
/// the address is needed here — never Agent C's key.
///
/// Selected by chain for the same reason the private keys are: Agent C is a
/// different keypair on testnet, and naming the local address there would put a
/// stranger on the job. The contract would then reject Agent C's signature with
/// NotAuthorizedEvaluator, stranding the escrow until the timeout.
function evaluatorAddress(): `0x${string}` {
  const prefix = CHAIN_ID === BASE_SEPOLIA_CHAIN_ID ? "BASE_SEPOLIA_" : "";
  const name = `${prefix}EVALUATOR_ADDRESS`;
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (required for chain ${CHAIN_ID})`);
  return value as `0x${string}`;
}

/// Hire Agent B: read its 402 quote, turn the goal into a brief against that
/// quote's own requirements, open and fund an on-chain job, and hand the brief
/// to the provider.
///
/// Order matters. createJob comes first because its jobId keys the work order;
/// the brief is posted before fundJob so it is already in the provider's hands
/// when JobFunded fires and its worker wakes.
export async function hire(agentBUrl: string, goal: string): Promise<HireResult> {
  const { wallet, account } = agentA();

  const res = await fetch(`${agentBUrl}/task`);
  if (res.status !== 402) {
    throw new Error(`expected HTTP 402 Payment Required from provider, got ${res.status}`);
  }
  const quote: unknown = await res.json();
  if (!isQuote(quote)) throw new Error("provider returned a malformed quote");

  const amount = BigInt(quote.price);
  console.log(
    `[agent-a] quote: ${formatUsdc(amount)} USDC from ${quote.provider} for ${quote.service}`,
  );

  // The quote's requirements become the brief's, so what the provider
  // advertised is exactly what the evaluator will grade against.
  const brief = await composeBrief(goal, quote.requirements);
  console.log(`[agent-a] brief: "${brief.title}" (${brief.requirements.length} requirements)`);

  const evaluator = evaluatorAddress();
  const createHash = await wallet.writeContract({
    address: addresses.JobContract,
    abi: JobContractAbi,
    functionName: "createJob",
    args: [quote.provider, evaluator, amount],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash });

  // createJob returns the id, but a return value is not readable from a receipt
  // — recover it from the event. Decode the receipt's own logs rather than
  // querying the chain again by block: a second round trip against a
  // load-balanced public RPC can hit a node that has not seen the block yet,
  // which surfaces as a zero blockHash and "block not found".
  const created = parseEventLogs({
    abi: JobContractAbi,
    eventName: "JobCreated",
    logs: receipt.logs,
  });
  const mine = created.find(
    (e) => e.args.client?.toLowerCase() === account.address.toLowerCase(),
  );
  if (mine?.args.jobId === undefined) {
    throw new Error("createJob emitted no JobCreated event for this client");
  }
  const jobId = mine.args.jobId;
  console.log(`[agent-a] job ${jobId} created, evaluator ${evaluator}`);

  const commissioned = await fetch(`${agentBUrl}/commission`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId: jobId.toString(), brief }),
  });
  if (!commissioned.ok) {
    throw new Error(`provider rejected the commission: HTTP ${commissioned.status}`);
  }

  const approveHash = await wallet.writeContract({
    address: addresses.MockUSDC,
    abi: MockUSDCAbi,
    functionName: "approve",
    args: [addresses.JobContract, amount],
  });
  const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
  if (approveReceipt.status !== "success") {
    throw new Error(`approve reverted (tx ${approveHash}) — job ${jobId} left unfunded`);
  }

  // Both retry, because a receipt does not guarantee the next request sees the
  // state it wrote — see fund.ts.
  await waitForAllowance({
    amount,
    readAllowance: () =>
      publicClient.readContract({
        address: addresses.MockUSDC,
        abi: MockUSDCAbi,
        functionName: "allowance",
        args: [account.address, addresses.JobContract],
      }) as Promise<bigint>,
  });

  await fundWithRetry({
    readState: async () =>
      (
        await publicClient.readContract({
          address: addresses.JobContract,
          abi: JobContractAbi,
          functionName: "getJob",
          args: [jobId],
        })
      ).state,
    send: async () => {
      const hash = await wallet.writeContract({
        address: addresses.JobContract,
        abi: JobContractAbi,
        functionName: "fundJob",
        args: [jobId],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return { status: receipt.status, hash };
    },
  });
  console.log(`[agent-a] job ${jobId} funded with ${formatUsdc(amount)} USDC — escrow held`);

  return { jobId, brief, quote };
}

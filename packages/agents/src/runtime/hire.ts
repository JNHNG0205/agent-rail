import { parseEventLogs, type Abi } from "viem";
import {
  addresses,
  JobContractAbi,
  MockUSDCAbi,
  formatUsdc,
  type PosterBrief,
} from "@agentrail/shared";
import { publicClient } from "../lib/wallet.js";
import { accountOf, getAgent, listAgents, type AgentRecord } from "./store.js";
import { rememberCommission } from "./server.js";

/// One hosted agent hiring another.
///
/// The counterparty is found in the directory rather than configured, which is
/// the whole point: neither agent knows the other exists until this runs.

export interface Quote {
  price: string;
  provider: `0x${string}`;
  requirements: string[];
  summary: string;
}

/// Providers a client could hire, cheapest first.
///
/// Reads the same directory an outside caller would, so nothing here depends on
/// being in-process — the selection would work identically over HTTP against a
/// runtime someone else operates.
export async function findProviders(exclude: string): Promise<AgentRecord[]> {
  return (await listAgents())
    .filter((a) => a.role === "provider" && a.service !== null && a.id !== exclude)
    .sort((a, b) => Number(a.service!.priceUsdc) - Number(b.service!.priceUsdc));
}

export interface HireResult {
  jobId: bigint;
  provider: AgentRecord;
  amount: bigint;
}

/// Hire a provider: open the job, hand over the brief, fund the escrow.
///
/// The brief's requirements are overwritten with the provider's published ones.
/// A client cannot choose what it will be graded against — otherwise it could
/// commission work under terms the provider never agreed to, and the evaluator
/// would judge against the wrong contract.
export async function hire(opts: {
  clientId: string;
  providerId: string;
  evaluator: `0x${string}`;
  brief: PosterBrief;
}): Promise<HireResult> {
  const clientRecord = await getAgent(opts.clientId);
  if (!clientRecord) throw new Error(`no agent "${opts.clientId}"`);
  if (clientRecord.role !== "client") {
    throw new Error(`"${clientRecord.name}" is a provider and cannot hire`);
  }

  const provider = await getAgent(opts.providerId);
  if (!provider?.service) throw new Error(`no provider "${opts.providerId}"`);

  const amount = BigInt(Math.round(Number(provider.service.priceUsdc) * 1e6));
  const brief: PosterBrief = { ...opts.brief, requirements: provider.service.requirements };

  const client = await accountOf(clientRecord);

  // createJob alone, because its jobId keys everything after it and a receipt is
  // the only way to learn it.
  const createTx = await client.send([
    {
      to: addresses.JobContract,
      abi: JobContractAbi as Abi,
      functionName: "createJob",
      args: [provider.address, opts.evaluator, amount],
    },
  ]);

  const receipt = await publicClient.getTransactionReceipt({ hash: createTx });
  const created = parseEventLogs({
    abi: JobContractAbi,
    eventName: "JobCreated",
    logs: receipt.logs,
  });
  const mine = created.find(
    (e) => e.args.client?.toLowerCase() === client.address.toLowerCase(),
  );
  if (mine?.args.jobId === undefined) {
    throw new Error("createJob emitted no JobCreated event for this client");
  }
  const jobId = mine.args.jobId;
  console.log(
    `[runtime] ${clientRecord.name} hired ${provider.name} — job ${jobId} for ${formatUsdc(amount)} USDC`,
  );

  // The brief must reach the provider before the escrow is funded: JobFunded is
  // what wakes its worker, and it has nothing to build without this.
  rememberCommission(provider.id, jobId, brief);

  // approve and fundJob batch. Sent apart they race the endpoint — approve is
  // mined, the node estimating fundJob has not applied that block, transferFrom
  // sees a zero allowance and estimation reverts.
  await client.send([
    {
      to: addresses.MockUSDC,
      abi: MockUSDCAbi as Abi,
      functionName: "approve",
      args: [addresses.JobContract, amount],
    },
    {
      to: addresses.JobContract,
      abi: JobContractAbi as Abi,
      functionName: "fundJob",
      args: [jobId],
    },
  ]);
  console.log(`[runtime] job ${jobId} funded — escrow held`);

  return { jobId, provider, amount };
}

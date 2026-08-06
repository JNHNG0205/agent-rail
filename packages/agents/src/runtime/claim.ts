import type { Abi } from "viem";
import { addresses, JobContractAbi, JobState, formatUsdc } from "@agentrail/shared";
import { publicClient } from "../lib/wallet.js";
import { accountOf, listAgents, type AgentRecord } from "./store.js";

/// Collect payment for delivered work the evaluator never ruled on.
///
/// A provider that delivers and is then ignored would otherwise wait forever:
/// only the evaluator can settle a Submitted job, and if it never does, the
/// escrow simply sits. JobContract answers this with claimTimeout — past the
/// deadline the provider takes the payment itself — which is what stops a silent
/// or absent evaluator from being able to withhold a fee indefinitely.
///
/// Nothing calls it on its own, so it is done here at startup. Without it the
/// remedy exists in the contract and is never exercised, which is the same as
/// not having it.
///
/// Only jobs this runtime provides for, and only past their deadline. The
/// contract enforces both, but checking first avoids spending gas to be told so.

export interface ClaimResult {
  jobId: bigint;
  agent: string;
  amount: bigint;
}

/// How many recent jobs to examine. Older ones will have been claimed already,
/// and a full scan grows without bound on a chain that never resets.
const LOOKBACK = 100n;

export async function claimOverdue(): Promise<ClaimResult[]> {
  const providers = (await listAgents()).filter((a) => a.role === "provider");
  if (providers.length === 0) return [];

  const byAddress = new Map<string, AgentRecord>(
    providers.map((p) => [p.address.toLowerCase(), p]),
  );

  const [nextJobId, head] = await Promise.all([
    publicClient.readContract({
      address: addresses.JobContract,
      abi: JobContractAbi,
      functionName: "nextJobId",
    }) as Promise<bigint>,
    publicClient.getBlockNumber(),
  ]);

  const first = nextJobId > LOOKBACK ? nextJobId - LOOKBACK : 0n;
  const claimed: ClaimResult[] = [];

  for (let id = first; id < nextJobId; id += 1n) {
    let job;
    try {
      job = await publicClient.readContract({
        address: addresses.JobContract,
        abi: JobContractAbi,
        functionName: "getJob",
        args: [id],
      });
    } catch {
      // A read failing says nothing about the other jobs.
      continue;
    }

    if (job.state !== JobState.Submitted) continue;
    if (head <= job.deadline) continue;

    const agent = byAddress.get(job.provider.toLowerCase());
    if (!agent) continue;

    try {
      const account = await accountOf(agent);
      await account.send([
        {
          to: addresses.JobContract,
          abi: JobContractAbi as Abi,
          functionName: "claimTimeout",
          args: [id],
        },
      ]);
      console.log(
        `[runtime] ${agent.name}: claimed job ${id} after timeout — ${formatUsdc(job.amount)} USDC`,
      );
      claimed.push({ jobId: id, agent: agent.name, amount: job.amount });
    } catch (err) {
      // Most likely the evaluator ruled between the read and the write, which
      // is the better outcome and not an error worth failing startup over.
      const detail = err instanceof Error ? err.message.split("\n")[0] : String(err);
      console.error(`[runtime] could not claim job ${id}: ${detail}`);
    }
  }

  return claimed;
}

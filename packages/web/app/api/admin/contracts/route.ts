import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin";
import { publicClient } from "@/lib/viem";
import { addresses, JobContractAbi, CHAIN_ID } from "@agentrail/shared";

/// GET /api/admin/contracts — how the deployed contracts are wired. Superadmin.
///
/// Read from the chain, never from `deployments.ts`, and that is the whole point
/// of the panel. The file records what was deployed; the contract records what
/// it points at now. An owner can re-point the identity registry, the evaluator
/// module and the reputation registry at any time, so the two can disagree — and
/// when they do, the chain is what every future job obeys.
///
/// Read-only, deliberately. Re-pointing a registry from a web page would mean
/// the deployer's key reaching a browser, and that key is the one thing here
/// that can rewrite the rules constraining a job.

export const dynamic = "force-dynamic";

type Getter = "owner" | "evaluatorModule" | "identityRegistry" | "reputationRegistry";

async function read(functionName: Getter): Promise<string | null> {
  try {
    const value = await publicClient.readContract({
      address: addresses.JobContract,
      abi: JobContractAbi,
      functionName,
    });
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { role, reason } = await checkAdmin(request);
  if (role !== "superadmin") {
    return NextResponse.json({ error: reason }, { status: 403 });
  }

  try {
    const [owner, evaluatorModule, identityRegistry, reputationRegistry] =
      await Promise.all([
        read("owner"),
        read("evaluatorModule"),
        read("identityRegistry"),
        read("reputationRegistry"),
      ]);

    return NextResponse.json({
      chainId: CHAIN_ID,
      jobContract: addresses.JobContract,
      owner,
      // Paired with what deploy.ts wrote, so drift is visible here rather than
      // something you notice by comparing two screens.
      wiring: [
        { name: "EvaluatorModule", onChain: evaluatorModule, expected: addresses.EvaluatorModule },
        { name: "IdentityRegistry", onChain: identityRegistry, expected: addresses.IdentityRegistry },
        { name: "ReputationRegistry", onChain: reputationRegistry, expected: addresses.ReputationRegistry },
      ],
    });
  } catch (err) {
    console.error("[api/admin/contracts]", err);
    return NextResponse.json({ error: "could not read the contract wiring" }, { status: 500 });
  }
}

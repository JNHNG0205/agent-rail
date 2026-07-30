import { keccak256, encodePacked } from "viem";
import { addresses, EvaluatorModuleAbi } from "@agentrail/shared";
import { publicClient, agentC } from "../lib/wallet.js";

/// Build the digest EvaluatorModule.submitApproval recovers against.
///
/// Must stay byte-identical to the contract:
///   keccak256(abi.encodePacked(jobId, deliverableHash, approved))
/// then wrapped by MessageHashUtils.toEthSignedMessageHash — which is what
/// signMessage({ message: { raw } }) applies. Verified against the deployed
/// contract by packages/contracts/scripts/e2e.ts.
export function approvalDigest(
  jobId: bigint,
  deliverableHash: `0x${string}`,
  approved: boolean,
): `0x${string}` {
  return keccak256(
    encodePacked(["uint256", "bytes32", "bool"], [jobId, deliverableHash, approved]),
  );
}

/// Sign the evaluator's decision and submit it. `approved` true settles the job
/// and pays the provider; false cancels it and refunds the client — one call
/// serves both outcomes, so a rejection is a first-class action rather than
/// Agent C declining to act.
///
/// submitApproval has no caller restriction: the signature is the
/// authorisation, so the evaluator submits its own.
export async function approve(
  jobId: bigint,
  deliverableHash: `0x${string}`,
  approved: boolean,
): Promise<`0x${string}`> {
  const { wallet } = agentC();

  const signature = await wallet.signMessage({
    message: { raw: approvalDigest(jobId, deliverableHash, approved) },
  });

  const hash = await wallet.writeContract({
    address: addresses.EvaluatorModule,
    abi: EvaluatorModuleAbi,
    functionName: "submitApproval",
    args: [jobId, deliverableHash, approved, signature],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  return hash;
}

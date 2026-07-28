import { addresses, EvaluatorModuleAbi } from "@agentrail/shared";
import { agentC } from "../lib/wallet.js";

/// Sign an approval over (jobId, deliverableHash) as the assigned evaluator and submit it to
/// the EvaluatorModule, which verifies the signature and settles the job. Agent C.
/// TODO(M4): blocked until M2 pins EIP-191 vs EIP-712 in EvaluatorModule.sol.
export async function approve(jobId: bigint, deliverableHash: `0x${string}`): Promise<`0x${string}`> {
  const { wallet, account } = agentC();
  // TODO(M4): build the same digest EvaluatorModule expects, signMessage/signTypedData,
  //           then call approveAndSettle(jobId, deliverableHash, signature).
  void wallet;
  void account;
  void addresses.EvaluatorModule;
  void EvaluatorModuleAbi;
  throw new Error("TODO(M4): approve()");
}

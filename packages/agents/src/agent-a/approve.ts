import { addresses, EvaluatorModuleAbi } from "@agentrail/shared";
import { agentA } from "../lib/wallet.js";

/// Sign an approval over (jobId, deliverableHash) and submit it to the
/// EvaluatorModule, which verifies the signature and settles the job. Member 4.
export async function approve(jobId: bigint, deliverableHash: `0x${string}`): Promise<`0x${string}`> {
  const { wallet, account } = agentA();
  // TODO(M4): build the same digest EvaluatorModule expects, signMessage/signTypedData,
  //           then call approveAndSettle(jobId, deliverableHash, signature).
  void wallet;
  void account;
  void addresses.EvaluatorModule;
  void EvaluatorModuleAbi;
  throw new Error("TODO(M4): approve()");
}

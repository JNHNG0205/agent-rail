import { addresses, JobContractAbi } from "@agentrail/shared";
import { agentA } from "../lib/wallet.js";

export interface QuoteResponse {
  price: string; // USDC minor units, as string
  provider: `0x${string}`;
  description: string;
  requirements: string[];
}

/// Hit Agent B's HTTP endpoint, read its 402 Payment Required quote, then
/// create + fund an on-chain job for that provider. Member 4.
export async function hire(agentBUrl: string): Promise<{ jobId: bigint; quote: QuoteResponse }> {
  // TODO(M4): fetch(`${agentBUrl}/task`), expect HTTP 402 with the quote JSON,
  //           parse price/provider, then call createJob + fundJob via JobContract.
  // TODO(M4): adopt quote.requirements into the brief passed to Agent C's review so the
  //           terms Agent B advertised and the terms it is graded against are the same array.
  const { wallet, account } = agentA();
  void wallet;
  void account;
  void addresses.JobContract;
  void JobContractAbi;
  throw new Error("TODO(M4): hire()");
}

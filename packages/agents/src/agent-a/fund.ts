import { JobState } from "@agentrail/shared";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/// Block until an approval is visible to a read.
///
/// A receipt proves the approve was mined, not that the next request will see
/// it. The endpoint is a pool of nodes, so a read — or the eth_estimateGas viem
/// runs before sending — can be answered by one that has not applied that block
/// yet. fundJob then calls transferFrom against a zero allowance and estimation
/// fails with a bare "execution reverted", naming neither the allowance nor the
/// lag that caused it.
export async function waitForAllowance(opts: {
  readAllowance: () => Promise<bigint>;
  amount: bigint;
  attempts?: number;
  delayMs?: number;
}): Promise<void> {
  const attempts = opts.attempts ?? 10;
  const delayMs = opts.delayMs ?? 1_000;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if ((await opts.readAllowance()) >= opts.amount) return;
    await sleep(delayMs);
  }
  throw new Error("approval did not become visible — the endpoint may be lagging badly");
}

/// Fund a job, retrying the revert the same lag can still cause.
///
/// Waiting for the allowance narrows the window but cannot close it: the read
/// and the gas estimate can be answered by different nodes. A revert here is
/// therefore usually transient and worth retrying.
///
/// State is re-read before every attempt, which is what makes retrying safe —
/// a job that is no longer Open has already been funded, so the retry stops
/// instead of paying twice.
export async function fundWithRetry(opts: {
  readState: () => Promise<number>;
  send: () => Promise<{ status: "success" | "reverted"; hash: string }>;
  attempts?: number;
  delayMs?: number;
}): Promise<void> {
  const attempts = opts.attempts ?? 3;
  const delayMs = opts.delayMs ?? 2_000;
  let lastError = "";

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if ((await opts.readState()) !== JobState.Open) return;

    try {
      const receipt = await opts.send();
      if (receipt.status === "success") return;
      lastError = `reverted on chain (tx ${receipt.hash})`;
    } catch (err) {
      lastError = err instanceof Error ? err.message.split("\n")[0]! : String(err);
    }

    // Back off further each time: a lagging node needs longer, not more haste.
    await sleep(delayMs * (attempt + 1));
  }

  throw new Error(`fundJob failed after ${attempts} attempts: ${lastError}`);
}

import type { Abi } from "viem";
import { publicClient } from "./wallet.js";

/// Poll for contract events using eth_getLogs over an explicit block cursor.
///
/// viem's watchContractEvent prefers eth_newFilter even with `poll: true`, which
/// breaks against a load-balanced public RPC: the filter is created on one node
/// and the follow-up eth_getFilterChanges is routed to another that has never
/// heard of it, so the watcher emits "filter not found" forever and delivers
/// nothing. Base Sepolia's public endpoint does exactly this.
///
/// eth_getLogs is stateless, so any node in the pool can answer it.
///
/// Delivery is at-least-once: the cursor only advances after onLogs resolves, so
/// a failure re-reads the same range rather than skipping it. Re-processing is
/// safe here because every on-chain action the agents take reverts on a repeat
/// (a job cannot be funded or submitted twice).
export function watchEvents(opts: {
  address: `0x${string}`;
  abi: Abi;
  eventName: string;
  onLogs: (logs: readonly unknown[]) => Promise<void> | void;
  onError?: (err: unknown) => void;
  /// Block to start from. Defaults to the current head, so only new events are
  /// seen — matching watchContractEvent's behaviour.
  fromBlock?: bigint;
  intervalMs?: number;
}): () => void {
  const interval = opts.intervalMs ?? 2_000;
  let cursor: bigint | undefined = opts.fromBlock;
  let stopped = false;
  let running = false;

  async function tick() {
    // Skip if the previous tick is still working; a slow LLM call must not
    // stack up overlapping polls.
    if (stopped || running) return;
    running = true;
    try {
      const latest = await publicClient.getBlockNumber();
      if (cursor === undefined) {
        cursor = latest + 1n;
        return;
      }
      if (latest < cursor) return;

      const logs = await publicClient.getContractEvents({
        address: opts.address,
        abi: opts.abi,
        eventName: opts.eventName,
        fromBlock: cursor,
        toBlock: latest,
      });

      if (logs.length > 0) await opts.onLogs(logs);
      cursor = latest + 1n;
    } catch (err) {
      // Leave the cursor where it is so the range is retried.
      opts.onError?.(err);
    } finally {
      running = false;
    }
  }

  const timer = setInterval(tick, interval);
  void tick();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

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
  /// Largest span asked for in one eth_getLogs call.
  ///
  /// Alchemy's free tier rejects any range wider than 10 blocks, and does it
  /// with -32600 "Invalid Request", which viem surfaces as "JSON is not a valid
  /// request object" — a message about malformed JSON for what is really a plan
  /// limit. The damage is not the failed call but the wedge that follows: the
  /// cursor only advances on success, so once the gap exceeds the cap every
  /// later poll asks for the same too-wide range and the agent never recovers.
  ///
  /// The gap grows during normal work, because the cursor waits for onLogs —
  /// Agent B spends an LLM call and a transaction there, which is easily more
  /// than 10 blocks on a 2-second chain. So this is reached on any real run, not
  /// only after an outage.
  maxBlockRange?: bigint;
}): () => void {
  const interval = opts.intervalMs ?? 2_000;
  const maxRange = opts.maxBlockRange ?? 10n;
  // Bound the work per tick so catching up cannot block the loop indefinitely;
  // whatever is left is picked up on the next one.
  const maxWindowsPerTick = 25;
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

      // Walk to the head in bounded windows, advancing the cursor after each one
      // so a failure part-way only costs the windows not yet done.
      let from: bigint = cursor;
      for (let window = 0; window < maxWindowsPerTick && from <= latest; window++) {
        const capped = from + maxRange - 1n;
        const to: bigint = capped < latest ? capped : latest;

        const logs = await publicClient.getContractEvents({
          address: opts.address,
          abi: opts.abi,
          eventName: opts.eventName,
          fromBlock: from,
          toBlock: to,
        });

        if (logs.length > 0) await opts.onLogs(logs);
        from = to + 1n;
        cursor = from;
      }
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

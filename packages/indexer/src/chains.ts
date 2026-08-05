/// Which chain the indexer follows.
///
/// Extracted from ponder.config so it can be tested: this had a real bug that
/// corrupted data rather than merely showing too much of it. The config used to
/// index every chain with a deployment, and `job` is keyed by jobId alone while
/// `agent` is keyed by address alone — so local job 0 and Base Sepolia job 0 are
/// the same row, and whichever synced last overwrote the other. A local demo
/// served testnet jobs through /api/jobs because of it.
///
/// Ponder loads its config at startup and cannot be handed test doubles, so the
/// decision lives here where it can be checked without a database or an RPC.

export interface ChainCandidate {
  name: string;
  id: number;
  rpc: string;
  disableCache: boolean;
}

export interface SelectOptions {
  candidates: readonly ChainCandidate[];
  /// The chain the rest of the stack is pointed at.
  chainId: number;
  /// Whether contracts have been deployed to a chain. A recorded address of
  /// zero means "not deployed", and indexing it would silently produce nothing.
  isDeployed: (chainId: number) => boolean;
  /// For the error message only.
  chainName?: (chainId: number) => string;
}

/// Exactly one chain, or a refusal explaining which one was missing.
export function selectChain(opts: SelectOptions): ChainCandidate {
  const match = opts.candidates.find(
    (c) => c.id === opts.chainId && opts.isDeployed(c.id),
  );
  if (match) return match;

  const name = opts.chainName?.(opts.chainId) ?? `chain ${opts.chainId}`;
  const known = opts.candidates.some((c) => c.id === opts.chainId);
  const reason = known
    ? `No AgentRail deployment on ${name} (CHAIN_ID=${opts.chainId}). Deploy to it first, or set CHAIN_ID to a chain that has one.`
    : `CHAIN_ID=${opts.chainId} is not a chain this indexer knows about.`;
  throw new Error(reason);
}

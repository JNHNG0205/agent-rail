import { keccak256, toBytes } from "viem";

/// Decide whether bytes a provider served are the work that was paid for.
///
/// The chain stores only the hash; the provider stores the bytes. Nothing forces
/// them to agree — a provider can serve whatever it likes from its own HTTP
/// endpoint, and a restart can leave it serving an older job's content. So the
/// hash is re-derived here and compared to what was committed on chain before
/// anything is shown.
///
/// Extracted from the route so the decision can be tested without a database, an
/// agent runtime or a Next request. It is the point where untrusted content
/// becomes trusted, which is exactly the logic that should not live only inside
/// a request handler.

export type DeliverableCheck =
  | { ok: true; content: string }
  | { ok: false; status: 404 | 409; error: string; onChain?: string; served?: string };

export function checkDeliverable(opts: {
  jobId: string;
  /// The hash the provider committed via submitDeliverable. Null until it has.
  onChainHash: string | null;
  /// The bytes the provider served, or null if it no longer has them.
  served: string | null;
}): DeliverableCheck {
  if (opts.onChainHash === null) {
    return {
      ok: false,
      status: 409,
      error: `job ${opts.jobId} has no deliverable yet`,
    };
  }

  if (opts.served === null) {
    // The provider keeps deliverables in memory, so a restart loses them. The
    // job is still settled and the hash is still on chain — only the content is
    // gone, and saying that is more useful than a bare 404.
    return {
      ok: false,
      status: 404,
      error: `the provider no longer has the deliverable for job ${opts.jobId}`,
    };
  }

  const actual = keccak256(toBytes(opts.served));
  if (actual.toLowerCase() !== opts.onChainHash.toLowerCase()) {
    return {
      ok: false,
      status: 409,
      error: `the served deliverable does not match the hash committed on chain for job ${opts.jobId}`,
      onChain: opts.onChainHash,
      served: actual,
    };
  }

  return { ok: true, content: opts.served };
}

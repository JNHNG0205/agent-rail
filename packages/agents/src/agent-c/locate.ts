/// Find where a provider serves, from its on-chain address alone.
///
/// The evaluator learns who produced the work from job.provider — an address,
/// which says nothing about where to fetch the deliverable. It used to read a
/// configured AGENT_B_URL, which only worked while there was exactly one
/// provider and it was known before startup. Neither holds once a user creates
/// providers at runtime.
///
/// So the address is resolved through the runtime's directory, the same listing
/// a hiring agent reads. Discovery is off-chain because IdentityRegistry stores
/// only address and token id, with nowhere to record an endpoint. Putting a
/// service URI on chain is the ERC-8004 shape and would remove this lookup
/// entirely — it needs a contract change.

interface DirectoryEntry {
  id: string;
  address: string;
}

function isDirectory(value: unknown): value is DirectoryEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (a) =>
        typeof a === "object" &&
        a !== null &&
        typeof (a as DirectoryEntry).id === "string" &&
        typeof (a as DirectoryEntry).address === "string",
    )
  );
}

export interface ProviderEndpoint {
  /// Base for /commission/:jobId and /deliverable/:jobId.
  base: string;
  label: string;
}

/// Where to fetch a job's brief and deliverable.
///
/// Returns null when the directory has no match. There used to be a fallback to
/// a single configured provider URL, from the design where exactly one existed
/// and its address was known before startup. Nothing serves that address now, so
/// the fallback could only turn "the runtime is unreachable" into a fetch
/// failure against a port nobody is listening on — a worse error, one step
/// further from the cause.
export async function locateProvider(
  providerAddress: string,
  opts: { runtimeUrl: string },
): Promise<ProviderEndpoint | null> {
  try {
    const res = await fetch(`${opts.runtimeUrl}/agents`);
    if (res.ok) {
      const body: unknown = await res.json();
      if (isDirectory(body)) {
        const match = body.find(
          (a) => a.address.toLowerCase() === providerAddress.toLowerCase(),
        );
        if (match) {
          return {
            base: `${opts.runtimeUrl}/agents/${match.id}`,
            label: match.id,
          };
        }
      }
    }
  } catch {
    // The runtime may not be running at all — that is not an error here, it just
    // means this deployment has no hosted agents.
  }

  return null;
}

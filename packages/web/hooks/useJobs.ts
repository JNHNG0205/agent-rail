"use client";

import { useEffect, useState, useCallback } from "react";
import { publicClient } from "@/lib/viem";
import { jobContract, readJobOnChain } from "@/lib/contracts";
import { toJob, JobState, JOB_STATE_LABELS, ZERO_ADDRESS } from "@agentrail/shared";
import type { Job, JobRow, JobStateLabel } from "@agentrail/shared";
import { useLiveEvents } from "./useLiveEvents";

export interface OnChainJobDetails {
  client: `0x${string}`;
  provider: `0x${string}`;
  evaluator: `0x${string}`;
  amount: bigint; // USDC minor units (6 decimals)
  state: JobState; // 0: Open, 1: Funded, 2: Submitted, 3: Terminal
  stateLabel: JobStateLabel;
  deliverableHash: `0x${string}`;
  timeoutBlocks: bigint;
  deadline: bigint;
}

export interface UseJobsOptions {
  jobId?: bigint | number;
  stateFilter?: JobStateLabel;
  agentAddress?: `0x${string}`;
}

/// Fetches active job state and details directly from JobContract.sol via viem's readContract,
/// combined with /api/jobs indexed data. Member 3.
export function useJobs(options?: UseJobsOptions) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobDetails, setActiveJobDetails] = useState<OnChainJobDetails | null>(null);
  const [rawRows, setRawRows] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { logs: liveEvents } = useLiveEvents();

  // Read a single job's live state directly from JobContract on-chain
  const fetchSingleJobOnChain = useCallback(async (targetId: bigint): Promise<OnChainJobDetails | null> => {
    if (!jobContract.address || jobContract.address === ZERO_ADDRESS) return null;
    try {
      const raw = await readJobOnChain(targetId);
      if (!raw) return null;

      const [client, provider, evaluator, amount, stateNum, deliverableHash, timeoutBlocks, deadline] = raw as [
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        bigint,
        number,
        `0x${string}`,
        bigint,
        bigint
      ];

      const state = stateNum as JobState;
      const stateLabel = JOB_STATE_LABELS[state] ?? "Open";

      return {
        client,
        provider,
        evaluator,
        amount,
        state,
        stateLabel,
        deliverableHash,
        timeoutBlocks,
        deadline,
      };
    } catch (err) {
      console.error(`[useJobs] Error reading on-chain job #${targetId}:`, err);
      return null;
    }
  }, []);

  // Fetch all jobs from /api/jobs indexed DB and optionally refresh single target job on-chain
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (options?.jobId !== undefined) {
        const details = await fetchSingleJobOnChain(BigInt(options.jobId));
        setActiveJobDetails(details);
      }

      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data: JobRow[] = await res.json();
        setRawRows(data);

        let parsed = data.map(toJob);

        if (options?.stateFilter) {
          parsed = parsed.filter((j) => JOB_STATE_LABELS[j.state] === options.stateFilter);
        }

        if (options?.agentAddress) {
          const addr = options.agentAddress.toLowerCase();
          parsed = parsed.filter(
            (j) => j.client.toLowerCase() === addr || j.provider.toLowerCase() === addr
          );
        }

        setJobs(parsed);
      }
    } catch (err) {
      console.error("[useJobs]", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [options?.jobId, options?.stateFilter, options?.agentAddress, fetchSingleJobOnChain]);

  // Re-fetch on-chain state and API data automatically when new contract logs arrive
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs, liveEvents.length]);

  return {
    jobs,
    activeJobDetails,
    rawRows,
    loading,
    error,
    refetch: fetchJobs,
    fetchSingleJobOnChain,
  };
}

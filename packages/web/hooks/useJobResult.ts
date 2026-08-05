"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { JOB_STATE_LABELS, type JobState } from "@agentrail/shared";
import { readJobOnChain } from "@/lib/contracts";

/// Follow one job to its conclusion and fetch what was produced. Member 4.
///
/// The stage comes from the chain, not the indexer. It used to come from the
/// indexed row, and the effect was that a job progressed on screen only as fast
/// as the indexer caught up — which, on a throttled endpoint, meant a job that
/// had already settled still showed as "submitted" minutes later. Someone
/// watching their own commission had no way to tell a slow system from a broken
/// one, and refreshing appeared to help because it was the only thing that ever
/// changed the number on screen.
///
/// The outcome still comes from the indexer, because the chain does not record
/// one: Terminal collapses settled, refunded and timed-out into a single state,
/// and only the events tell them apart. So the stage moves immediately and the
/// verdict fills in a moment later, which is the right way round — "it finished"
/// is the urgent half, "how it finished" can arrive second.

export type JobStage = "Open" | "Funded" | "Submitted" | "Terminal";

export interface JobProgress {
  stage: JobStage | null;
  /// Terminal collapses three different endings, so the outcome is what says
  /// whether the provider was paid or the client refunded.
  outcome: "completed" | "cancelled" | "timeoutClaimed" | null;
  deliverableUrl: string | null;
  waiting: boolean;
  error: string | null;
}

interface JobRow {
  id: string;
  state: JobStage;
  outcome: JobProgress["outcome"];
  deliverableHash: string | null;
}

interface OnChainJob {
  state: JobState;
  deliverableHash: `0x${string}`;
}

const NO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

/// Fast while something is happening, slow once it has stopped. A finished job
/// still needs one more read to learn its outcome, and polling a settled job
/// every few seconds for the rest of the session is a cost with no answer at
/// the end of it.
const ACTIVE_MS = 4_000;
const SETTLED_MS = 15_000;

export function useJobResult(jobId: string | null): JobProgress {
  const [stage, setStage] = useState<JobStage | null>(null);
  const [outcome, setOutcome] = useState<JobProgress["outcome"]>(null);
  const [deliverableUrl, setDeliverableUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read inside the interval callback so changing the rate does not restart the
  // timer, which would reset the countdown on every state change.
  const settled = useRef(false);

  const poll = useCallback(async () => {
    if (!jobId) return;
    try {
      const onChain = (await readJobOnChain(BigInt(jobId))) as OnChainJob | null;
      if (onChain && typeof onChain.state === "number") {
        const label = JOB_STATE_LABELS[onChain.state] as JobStage;
        setStage(label);
        settled.current = label === "Terminal";
        // Offered as soon as the hash is on chain. The route re-derives it from
        // the bytes before serving, so this cannot show unverified content.
        setDeliverableUrl(
          onChain.deliverableHash && onChain.deliverableHash !== NO_HASH
            ? `/api/deliverable/${jobId}`
            : null,
        );
      }

      // Only the indexer knows which ending it was. Absent means it has not
      // caught up, which is not an error — the stage above is already right.
      const res = await fetch(`/api/jobs?id=${encodeURIComponent(jobId)}`);
      if (res.ok) {
        const rows = (await res.json()) as JobRow[];
        if (rows[0]) setOutcome(rows[0].outcome);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not read job state");
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setStage(null);
      setOutcome(null);
      setDeliverableUrl(null);
      settled.current = false;
      return;
    }

    void poll();
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      timer = setTimeout(async () => {
        await poll();
        tick();
      }, settled.current ? SETTLED_MS : ACTIVE_MS);
    };
    tick();
    return () => clearTimeout(timer);
  }, [jobId, poll]);

  return {
    stage,
    outcome,
    deliverableUrl,
    waiting: jobId !== null && stage !== "Terminal",
    error,
  };
}

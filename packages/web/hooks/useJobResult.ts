"use client";

import { useCallback, useEffect, useState } from "react";

/// Follow one job to its conclusion and fetch what was produced. Member 4.
///
/// Polls the indexed job rather than the chain: the indexer is already following
/// every event, and the deliverable route needs the indexed row anyway to learn
/// which provider served it.

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

export function useJobResult(jobId: string | null): JobProgress {
  const [stage, setStage] = useState<JobStage | null>(null);
  const [outcome, setOutcome] = useState<JobProgress["outcome"]>(null);
  const [deliverableUrl, setDeliverableUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const poll = useCallback(async () => {
    if (!jobId) return;
    try {
      // By id, not by scanning a page of recent jobs: that page is capped, so a
      // job old enough to fall off it would poll forever and never resolve.
      const res = await fetch(`/api/jobs?id=${encodeURIComponent(jobId)}`);
      if (!res.ok) return;
      const rows = (await res.json()) as JobRow[];
      const row = rows[0];
      // Absent simply means the indexer has not caught up yet — not an error.
      if (!row) return;

      setStage(row.state);
      setOutcome(row.outcome);
      // Only offer the deliverable once one exists; the route verifies its hash
      // against the chain before serving it.
      setDeliverableUrl(row.deliverableHash ? `/api/deliverable/${jobId}` : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not read job state");
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setStage(null);
      setOutcome(null);
      setDeliverableUrl(null);
      return;
    }
    void poll();
    const timer = setInterval(poll, 4000);
    return () => clearInterval(timer);
  }, [jobId, poll]);

  return {
    stage,
    outcome,
    deliverableUrl,
    waiting: jobId !== null && stage !== "Terminal",
    error,
  };
}

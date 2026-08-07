"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/lib/errors";

/// The evaluator's reasoning, by job id. Member 4.
///
/// Fetched once for the page rather than per job: a list of rulings would
/// otherwise open one request per row, and the whole set is a few hundred short
/// sentences.
///
/// An empty map is a normal state, not a failure. Nothing here has been judged
/// until an evaluator has run against this database, and a fresh installation
/// reading somebody else's chain history will see jobs it has no reasoning for —
/// the ruling was recorded on the machine that made it.

export interface Review {
  jobId: string;
  approve: boolean;
  reason: string;
  present: string[];
  missing: string[];
}

/// `signal` is any value that changes when the set of judged jobs might have.
/// Rulings are written by a separate process while this page is open, and a
/// fetch on mount alone meant a job settling in front of somebody kept showing
/// "no reasoning recorded" until they reloaded — which is how this was found.
export function useReviews(signal?: string, limit = 200) {
  const [byJob, setByJob] = useState<Map<string, Review>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?limit=${limit}`);
      const body = (await res.json()) as { reviews?: Review[]; error?: string };
      if (body.error) throw new Error(body.error);
      setByJob(new Map((body.reviews ?? []).map((r) => [r.jobId, r])));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "could not load the rulings"));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load, signal]);

  return { byJob, loading, error, refetch: load };
}

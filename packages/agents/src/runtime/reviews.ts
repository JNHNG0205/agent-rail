import { CHAIN_ID } from "@agentrail/shared";
import type { DeliverableReview } from "@agentrail/shared";
import { query } from "./db.js";

/// The evaluator's reasoning, kept so somebody can read it.
///
/// The chain settles on a signature: it records that a verdict was signed, by
/// whom, and which way it went. It does not record why, and until now nothing
/// else did either — the sentence the evaluator wrote went to its own stdout,
/// which answers the question only for whoever was watching a terminal at the
/// time.
///
/// That is the wrong place for it. "Why did this refund?" is the question an
/// escrow exists to raise, and a client who is told their money came back and
/// nothing else has no way to tell a fair rejection from a broken one.
///
/// Deliberately not on chain. Storing prose there would cost gas on every job to
/// hold something no contract reads, and would make a model's sentence
/// permanent and unamendable. The signature is what moves money; this is the
/// note that came with it.

export interface StoredReview {
  jobId: string;
  approve: boolean;
  reason: string;
  present: string[];
  missing: string[];
}

interface Row {
  job_id: string;
  approve: boolean;
  reason: string;
  present: string[];
  missing: string[];
}

/// Written after the verdict is decided and before it is submitted, so a crash
/// between the two leaves a record of what was about to happen rather than a
/// settled job nobody can explain.
export async function rememberReview(
  jobId: bigint,
  review: DeliverableReview,
): Promise<void> {
  // ON CONFLICT: the evaluator sweeps for jobs it missed on startup, so the same
  // job can be judged twice. The later reading is the one that was acted on.
  await query(
    `INSERT INTO $SCHEMA.job_review (chain_id, job_id, approve, reason, present, missing)
          VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (chain_id, job_id) DO UPDATE SET
       approve = EXCLUDED.approve,
       reason  = EXCLUDED.reason,
       present = EXCLUDED.present,
       missing = EXCLUDED.missing`,
    [
      CHAIN_ID,
      jobId.toString(),
      review.approve,
      review.reason,
      JSON.stringify(review.presentElements),
      JSON.stringify(review.missingElements),
    ],
  );
}

export async function getReview(jobId: bigint): Promise<StoredReview | undefined> {
  const rows = await query<Row>(
    `SELECT job_id, approve, reason, present, missing
       FROM $SCHEMA.job_review
      WHERE chain_id = $1 AND job_id = $2`,
    [CHAIN_ID, jobId.toString()],
  );
  const row = rows[0];
  if (!row) return undefined;
  return {
    jobId: row.job_id,
    approve: row.approve,
    reason: row.reason,
    present: row.present,
    missing: row.missing,
  };
}

/// Most recent first, for the page that lists rulings. Bounded because it feeds
/// a view, and an unbounded read grows with the chain's whole history.
export async function listReviews(limit = 100): Promise<StoredReview[]> {
  const rows = await query<Row>(
    `SELECT job_id, approve, reason, present, missing
       FROM $SCHEMA.job_review
      WHERE chain_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [CHAIN_ID, Math.min(Math.max(limit, 1), 500)],
  );
  return rows.map((row) => ({
    jobId: row.job_id,
    approve: row.approve,
    reason: row.reason,
    present: row.present,
    missing: row.missing,
  }));
}

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { ChainEvent } from "@agentrail/shared";

const COLUMNS = `id,
        chain_id        AS "chainId",
        contract,
        event_name      AS "eventName",
        job_id          AS "jobId",
        tx_hash         AS "txHash",
        log_index       AS "logIndex",
        block_number    AS "blockNumber",
        block_timestamp AS "blockTimestamp",
        args`;

/// GET /api/events?jobId=<n> — event feed from the Ponder-indexed cache. Member 4.
///
/// Ordered by chain position, never by insertion time: a timestamp ties for
/// events in the same block — the settle transaction alone emits three — and
/// misorders entirely when a backfill runs after live events.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  // job_id is numeric, so bind the raw string rather than Number(): a job id
  // beyond 2^53 would round.
  if (jobId !== null && !/^\d+$/.test(jobId)) {
    return NextResponse.json({ error: "jobId must be a non-negative integer" }, { status: 400 });
  }

  try {
    const rows = jobId
      ? await query<ChainEvent>(
          `SELECT ${COLUMNS} FROM event WHERE job_id = $1
            ORDER BY block_number DESC, log_index DESC LIMIT 50`,
          [jobId],
        )
      : await query<ChainEvent>(
          `SELECT ${COLUMNS} FROM event
            ORDER BY block_number DESC, log_index DESC LIMIT 50`,
        );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[api/events]", err);
    return NextResponse.json({ error: "failed to load events" }, { status: 500 });
  }
}

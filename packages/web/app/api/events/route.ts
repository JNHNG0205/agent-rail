import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { ChainEvent } from "@agentrail/shared";

/// GET /api/events?jobId=<n> — recent event feed from the indexed cache. Member 4.
/// Ordered by chain position, not insertion time: created_at ties for events in
/// the same block and misorders entirely when a backfill runs after live events.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  try {
    const rows = jobId
      ? await query<ChainEvent>(
          "SELECT id, contract, event_name AS \"eventName\", job_id AS \"jobId\", tx_hash AS \"txHash\", block_number AS \"blockNumber\", log_index AS \"logIndex\", args, created_at AS \"createdAt\" FROM events WHERE job_id = $1 ORDER BY block_number DESC, log_index DESC LIMIT 50",
          [Number(jobId)]
        )
      : await query<ChainEvent>(
          "SELECT id, contract, event_name AS \"eventName\", job_id AS \"jobId\", tx_hash AS \"txHash\", block_number AS \"blockNumber\", log_index AS \"logIndex\", args, created_at AS \"createdAt\" FROM events ORDER BY block_number DESC, log_index DESC LIMIT 50"
        );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[api/events]", err);
    return NextResponse.json({ error: "failed to load events" }, { status: 500 });
  }
}

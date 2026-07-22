import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/// GET /api/events?jobId=<n> — recent event feed from the indexed cache. Member 4.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  try {
    const rows = jobId
      ? await query(
          "SELECT id, contract, event_name AS \"eventName\", job_id AS \"jobId\", tx_hash AS \"txHash\", block_number AS \"blockNumber\", args, created_at AS \"createdAt\" FROM events WHERE job_id = $1 ORDER BY created_at DESC LIMIT 50",
          [Number(jobId)]
        )
      : await query(
          "SELECT id, contract, event_name AS \"eventName\", job_id AS \"jobId\", tx_hash AS \"txHash\", block_number AS \"blockNumber\", args, created_at AS \"createdAt\" FROM events ORDER BY created_at DESC LIMIT 50"
        );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[api/events]", err);
    return NextResponse.json({ error: "failed to load events" }, { status: 500 });
  }
}

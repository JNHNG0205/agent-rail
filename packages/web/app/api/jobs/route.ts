import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { JobRow } from "@agentrail/shared";

/// GET /api/jobs — jobs from the indexed Postgres cache. Member 4.
/// Returns JobRow, not Job: amount and createdBlock are strings because JSON
/// cannot carry a bigint. Callers needing arithmetic use toJob().
export async function GET() {
  try {
    const rows = await query<JobRow>(
      "SELECT id, client, provider, evaluator, amount, state, deliverable_hash AS \"deliverableHash\", created_block AS \"createdBlock\", updated_at AS \"updatedAt\" FROM jobs ORDER BY id DESC"
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[api/jobs]", err);
    return NextResponse.json({ error: "failed to load jobs" }, { status: 500 });
  }
}

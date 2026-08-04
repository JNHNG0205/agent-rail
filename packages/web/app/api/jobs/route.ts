import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { JobRow } from "@agentrail/shared";

/// GET /api/jobs — jobs from the Ponder-indexed cache. Member 4.
///
/// Returns JobRow, not Job: every numeric column arrives as a string because
/// JSON cannot carry a bigint. Callers needing arithmetic use toJob().
/// `outcome` distinguishes the three endings that Terminal collapses together.
export async function GET() {
  try {
    const rows = await query<JobRow>(
      `SELECT id,
              client,
              provider,
              evaluator,
              amount,
              state,
              deliverable_hash AS "deliverableHash",
              outcome,
              created_block    AS "createdBlock",
              updated_block    AS "updatedBlock"
         FROM job
        ORDER BY id DESC`,
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[api/jobs]", err);
    return NextResponse.json({ error: "failed to load jobs" }, { status: 500 });
  }
}

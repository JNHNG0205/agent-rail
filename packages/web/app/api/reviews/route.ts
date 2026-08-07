import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { CHAIN_ID } from "@agentrail/shared";
import { checkAdmin } from "@/lib/admin";

/// GET /api/reviews — why each job settled or refunded. Member 4.
///
/// The chain says a verdict was signed and which way it went; it does not say
/// why. The evaluator writes a sentence explaining itself, and that sentence is
/// the only thing that turns "your money came back" into something a person can
/// check. It is stored by the evaluator in the runtime schema.
///
/// Read straight from Postgres rather than proxied through the agent runtime, so
/// past rulings stay readable when the runtime is not running. History should
/// not depend on a process that only matters to jobs still in flight.
///
/// Read-only, and deliberately so: this route never writes to a schema it does
/// not own.

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

interface Row {
  jobId: string;
  approve: boolean;
  reason: string;
  present: string[];
  missing: string[];
}

export async function GET(request: Request) {
  const { admin, reason } = await checkAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: reason }, { status: 403 });
  }

  const url = new URL(request.url);
  const raw = url.searchParams.get("limit");
  const parsed = raw === null ? DEFAULT_LIMIT : Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    return NextResponse.json(
      { error: `limit must be an integer between 1 and ${MAX_LIMIT}` },
      { status: 400 },
    );
  }

  try {
    const rows = await query<Row>(
      `SELECT job_id AS "jobId", approve, reason, present, missing
         FROM runtime.job_review
        WHERE chain_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [CHAIN_ID, parsed],
    );
    return NextResponse.json({ reviews: rows });
  } catch (err) {
    // The table exists only once an evaluator has run against this database. A
    // fresh installation that has judged nothing is not an error, and a page
    // that fails here would be reporting a fault where there is simply no
    // history yet.
    const message = err instanceof Error ? err.message : String(err);
    if (/relation .*job_review.* does not exist/i.test(message)) {
      return NextResponse.json({ reviews: [] });
    }
    console.error("[api/reviews]", err);
    return NextResponse.json({ error: "failed to load the evaluator's rulings" }, { status: 500 });
  }
}

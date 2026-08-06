import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { JobRow } from "@agentrail/shared";

/// GET /api/jobs — jobs from the Ponder-indexed cache. Member 4.
///
/// Returns JobRow, not Job: every numeric column arrives as a string because
/// JSON cannot carry a bigint. Callers needing arithmetic use toJob().
/// `outcome` distinguishes the three endings that Terminal collapses together.
///
/// Returns the most recent jobs, not all of them. Base Sepolia never resets, so
/// this list only ever grows — every rehearsal, every test and every failed
/// experiment stays in it permanently. Fetching the lot to render a page gets
/// slower forever and buries what just happened.
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 500;

const SELECT = `SELECT id,
                       client,
                       provider,
                       evaluator,
                       amount,
                       state,
                       deliverable_hash AS "deliverableHash",
                       outcome,
                       created_block    AS "createdBlock",
                       updated_block    AS "updatedBlock"
                  FROM job`;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  // One job by id. Without this a caller watching a specific job has to fetch a
  // page of recent ones and hope it is on it — which works until the job is old
  // enough to fall off, and then simply never resolves.
  const id = params.get("id");
  if (id !== null) {
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
    }
    try {
      const rows = await query<JobRow>(`${SELECT} WHERE id = $1`, [id]);
      return NextResponse.json(rows);
    } catch (err) {
      console.error("[api/jobs]", err);
      return NextResponse.json({ error: "failed to load jobs" }, { status: 500 });
    }
  }

  const raw = params.get("limit");
  let limit = DEFAULT_LIMIT;
  if (raw !== null) {
    if (!/^\d+$/.test(raw)) {
      return NextResponse.json({ error: "limit must be a positive integer" }, { status: 400 });
    }
    limit = Number(raw);
    if (limit < 1 || limit > MAX_LIMIT) {
      return NextResponse.json(
        { error: `limit must be between 1 and ${MAX_LIMIT}` },
        { status: 400 },
      );
    }
  }

  try {
    const rows = await query<JobRow>(`${SELECT} ORDER BY id DESC LIMIT $1`, [limit]);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[api/jobs]", err);
    return NextResponse.json({ error: "failed to load jobs" }, { status: 500 });
  }
}

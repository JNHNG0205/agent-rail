import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/// GET /api/jobs — jobs (+ recent events) from the indexed Postgres cache. Member 4.
export async function GET() {
  try {
    const rows = await query(
      "SELECT id, client, provider, amount, state, deliverable_hash AS \"deliverableHash\", created_block AS \"createdBlock\", updated_at AS \"updatedAt\" FROM jobs ORDER BY id DESC"
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[api/jobs]", err);
    return NextResponse.json({ error: "failed to load jobs" }, { status: 500 });
  }
}

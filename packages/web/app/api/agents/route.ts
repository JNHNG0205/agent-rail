import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { Agent } from "@agentrail/shared";

/// GET /api/agents — registered agents from the indexed Postgres cache. Member 4.
export async function GET() {
  try {
    const rows = await query<Agent>(
      "SELECT address, token_id AS \"tokenId\", name, reputation, registered_at AS \"registeredAt\" FROM agents ORDER BY reputation DESC"
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[api/agents]", err);
    return NextResponse.json({ error: "failed to load agents" }, { status: 500 });
  }
}

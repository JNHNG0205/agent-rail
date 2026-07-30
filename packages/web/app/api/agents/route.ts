import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { Agent } from "@agentrail/shared";

/// GET /api/agents — registered agents from the Ponder-indexed cache. Member 4.
///
/// Ponder owns these tables: singular names, snake_case columns, and every
/// numeric column arrives as a string. There is no `name` column because
/// IdentityRegistry.registerAgent stores no label — resolve it in the UI with
/// agentLabel(address).
export async function GET() {
  try {
    const rows = await query<Agent>(
      `SELECT address,
              token_id      AS "tokenId",
              reputation,
              registered_at AS "registeredAt"
         FROM agent
        ORDER BY reputation DESC, address`,
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[api/agents]", err);
    return NextResponse.json({ error: "failed to load agents" }, { status: 500 });
  }
}

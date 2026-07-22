import { Pool } from "pg";

/// Shared Postgres pool for the indexer. The web app has its own pool in
/// packages/web/lib/db.ts — they never share a process.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const res = await pool.query(text, params as never[]);
  return res.rows as T[];
}

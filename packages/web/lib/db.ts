import { Pool } from "pg";

/// Postgres pool used ONLY by API routes (server-side). Client components must
/// never import this — they talk to the DB through /api/* routes. Member 4.
declare global {
  // eslint-disable-next-line no-var
  var __agentrailPool: Pool | undefined;
}

// Reuse one pool across hot reloads in dev.
export const pool =
  global.__agentrailPool ??
  new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  global.__agentrailPool = pool;
}

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const res = await pool.query(text, params as never[]);
  return res.rows as T[];
}

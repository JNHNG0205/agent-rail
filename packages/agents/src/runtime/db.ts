import { Pool } from "pg";

/// Storage for the runtime's own state — the agents a user created, and their
/// keys.
///
/// Deliberately NOT the `public` schema. Ponder owns that one and recreates it
/// from scratch: `ponder start --schema public`, and scripts/dev.sh drops it
/// outright when the chain changes. An identity token is soulbound, so an
/// agent's address is permanent — a dropped key orphans that registration with
/// no way to mint another for the address or move the one it holds. Sharing a
/// schema with something that drops it would destroy agents on an unrelated
/// action.
///
/// Postgres rather than a file because a container's disk is ephemeral: a
/// redeploy wipes it, and the loss is silent and permanent.
const SCHEMA = "runtime";

let pool: Pool | undefined;
let ready: Promise<void> | undefined;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — the agent runtime stores agent keys in Postgres",
    );
  }
  return url;
}

function getPool(): Pool {
  pool ??= new Pool({ connectionString: connectionString(), max: 4 });
  return pool;
}

/// Create the schema and table if absent. Runs once per process.
export function initDb(): Promise<void> {
  ready ??= (async () => {
    await getPool().query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.agent (
        id           text        NOT NULL,
        chain_id     integer     NOT NULL,
        name         text        NOT NULL,
        role         text        NOT NULL,
        service      jsonb,
        private_key  text        NOT NULL,
        address      text        NOT NULL,
        created_by   text,
        created_at   timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (chain_id, id)
      )
    `);
    // Added after the table existed, so it must be applied separately. Nullable
    // on purpose: agents created before ownership have no owner, and they stay
    // usable as a shared set rather than becoming unreachable.
    await getPool().query(
      `ALTER TABLE ${SCHEMA}.agent ADD COLUMN IF NOT EXISTS created_by text`,
    );
    await getPool().query(
      `CREATE INDEX IF NOT EXISTS agent_owner_idx ON ${SCHEMA}.agent (chain_id, created_by)`,
    );
    // An address may hold only one identity, so two agents cannot share one.
    await getPool().query(
      `CREATE UNIQUE INDEX IF NOT EXISTS agent_address_idx ON ${SCHEMA}.agent (chain_id, lower(address))`,
    );
  })();
  return ready;
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  await initDb();
  const result = await getPool().query(sql.replace(/\$SCHEMA/g, SCHEMA), params);
  return result.rows as T[];
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  ready = undefined;
}

export { SCHEMA };

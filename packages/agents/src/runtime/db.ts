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
    // When onboarding finished. Null means it never did: the row is written
    // before the agent is funded and registered, so a failure part way leaves
    // a key that can be retried rather than lost — but the agent cannot work
    // until it holds an identity, and advertising it invites clients to
    // commission work it will fail at createJob.
    //
    // Backfilled once, when the column is first added: every agent that existed
    // before this had already completed onboarding, and running the backfill on
    // each startup would quietly mark future failures as successes.
    await getPool().query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = '${SCHEMA}' AND table_name = 'agent'
             AND column_name = 'onboarded_at'
        ) THEN
          ALTER TABLE ${SCHEMA}.agent ADD COLUMN onboarded_at timestamptz;
          UPDATE ${SCHEMA}.agent SET onboarded_at = created_at;
        END IF;
      END $$;
    `);

    // What each job asked for and what came back. Survives a restart: the
    // deliverable is the thing that was paid for, and no timeout brings it back
    // once the job has settled on its hash.
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.job_work (
        chain_id    integer     NOT NULL,
        job_id      text        NOT NULL,
        agent_id    text        NOT NULL,
        brief       jsonb,
        deliverable text,
        created_at  timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (chain_id, job_id)
      )
    `);
    // Why each job settled or refunded, in the evaluator's own words.
    //
    // The chain records that a verdict was signed and what it decided; it does
    // not record the reasoning, and neither did anything else — the sentence
    // went to the evaluator's stdout and nowhere a person could reach it. That
    // left the one question an escrow raises, "why did this refund?", answerable
    // only by whoever happened to be watching a terminal.
    //
    // Not authoritative. The money moved on the signature; this is the note that
    // came with it, and if the two ever disagree the chain is right.
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.job_review (
        chain_id   integer     NOT NULL,
        job_id     text        NOT NULL,
        approve    boolean     NOT NULL,
        reason     text        NOT NULL,
        present    jsonb       NOT NULL DEFAULT '[]'::jsonb,
        missing    jsonb       NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (chain_id, job_id)
      )
    `);
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

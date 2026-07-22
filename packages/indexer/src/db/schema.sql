-- AgentRail indexed read-cache. The chain is the source of truth; if this
-- disagrees with the chain, the chain wins. Apply with:
--   psql "$DATABASE_URL" -f packages/indexer/src/db/schema.sql

CREATE TABLE IF NOT EXISTS agents (
  address        TEXT PRIMARY KEY,
  token_id       INTEGER,
  name           TEXT,
  reputation     INTEGER DEFAULT 0,
  registered_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS jobs (
  id               INTEGER PRIMARY KEY,          -- on-chain job id
  client           TEXT REFERENCES agents(address),
  provider         TEXT REFERENCES agents(address),
  amount           NUMERIC,                      -- USDC (6 decimals)
  state            TEXT,                         -- Open|Funded|Submitted|Terminal
  deliverable_hash TEXT,
  created_block    BIGINT,
  updated_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS events (
  id             SERIAL PRIMARY KEY,
  contract       TEXT,
  event_name     TEXT,
  job_id         INTEGER,
  tx_hash        TEXT,
  block_number   BIGINT,
  args           JSONB,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_job_id_idx ON events (job_id);
CREATE INDEX IF NOT EXISTS events_created_at_idx ON events (created_at DESC);

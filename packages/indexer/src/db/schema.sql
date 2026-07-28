-- AgentRail indexed read-cache. The chain is the source of truth; if this
-- disagrees with the chain, the chain wins and the cache is rebuilt.
--
-- Apply with `npm run db:setup`. Re-running is safe on a fresh database; to
-- pick up a schema change on an existing one, `npm run db:reset` first — the
-- data here is disposable by design.
--
-- Two kinds of table:
--   events            append-only decoded log; the audit trail
--   agents, jobs      current state projected from those events

CREATE TABLE IF NOT EXISTS agents (
  address        TEXT PRIMARY KEY,             -- lowercase hex
  token_id       INTEGER,
  name           TEXT,
  reputation     INTEGER DEFAULT 0,
  registered_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS jobs (
  id               INTEGER PRIMARY KEY,        -- on-chain job id
  -- No FK to agents. The indexer watches JobContract and IdentityRegistry
  -- through separate subscriptions with no cross-contract ordering guarantee,
  -- so a JobCreated can arrive before its agents' AgentRegistered. Under a FK
  -- that insert fails and the job is lost; the alternative — inserting
  -- placeholder agent rows — would surface nameless phantom agents in
  -- /api/agents. A cache should tolerate arriving out of order.
  client           TEXT,
  provider         TEXT,
  evaluator        TEXT,                       -- signs the approval that settles
  amount           NUMERIC,                    -- USDC minor units, 6 decimals
  state            TEXT,                       -- Open|Funded|Submitted|Terminal
  deliverable_hash TEXT,
  created_block    BIGINT,
  updated_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS events (
  id             SERIAL PRIMARY KEY,
  contract       TEXT,
  event_name     TEXT,
  job_id         INTEGER,
  tx_hash        TEXT        NOT NULL,
  log_index      INTEGER     NOT NULL,         -- position within the tx
  block_number   BIGINT,
  args           JSONB,                        -- bigints stringified before write
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Identity of a log on-chain. Lets handlers ON CONFLICT DO NOTHING so a
-- reconnect, restart, or backfill overlapping the live stream cannot duplicate
-- the feed. NOT NULL on both columns is load-bearing: Postgres treats NULLs as
-- distinct, so a nullable column here would silently permit duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS events_tx_log_idx ON events (tx_hash, log_index);

CREATE INDEX IF NOT EXISTS events_job_id_idx ON events (job_id);
CREATE INDEX IF NOT EXISTS events_created_at_idx ON events (created_at DESC);

-- /agents/[address] lists the jobs an agent took part in, in any of its roles.
CREATE INDEX IF NOT EXISTS jobs_client_idx ON jobs (client);
CREATE INDEX IF NOT EXISTS jobs_provider_idx ON jobs (provider);
CREATE INDEX IF NOT EXISTS jobs_evaluator_idx ON jobs (evaluator);

-- Resume point for backfill. watchContractEvent only delivers events from the
-- moment it subscribes, so on boot the indexer replays getContractEvents from
-- here before going live; without it, anything that happened while the indexer
-- was down is invisible forever.
CREATE TABLE IF NOT EXISTS indexer_state (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

# AgentRail — Monorepo Architecture Plan

Decentralised AI agent payment settlement DApp (CT124-3-3 Group 7)

Stack: Solidity + Hardhat · Next.js (App Router) · PostgreSQL · viem · Node.js agents

---

## 1. Repository Layout

```
agent-rail/
├── package.json                  # Root workspace config (npm workspaces)
├── turbo.json                    # (Optional) Turborepo task pipeline
├── .gitignore
├── .env.example                  # Template env vars — never commit real .env
├── README.md                     # Project overview + quickstart
├── documentation.md              # Assignment submission doc (setup + features)
│
├── packages/
│   ├── contracts/                # ── Member 1 + Member 2 ──
│   │   ├── package.json
│   │   ├── hardhat.config.ts
│   │   ├── contracts/
│   │   │   ├── JobContract.sol           # ERC-8183 job lifecycle + escrow (M1)
│   │   │   ├── EvaluatorModule.sol       # ERC-7579 module, ECDSA verify (M2)
│   │   │   ├── IdentityRegistry.sol      # ERC-8004 identity, ERC-721 (M2)
│   │   │   ├── ReputationRegistry.sol    # ERC-8004 reputation counter (M2)
│   │   │   └── mocks/
│   │   │       └── MockUSDC.sol          # ERC-20 test token (M1)
│   │   ├── scripts/
│   │   │   ├── deploy.ts                 # Deploy all contracts, write addresses
│   │   │   └── seed.ts                   # Register agents, fund wallets (demo)
│   │   ├── test/
│   │   │   ├── JobContract.test.ts       # State transition tests (M1)
│   │   │   └── EvaluatorModule.test.ts   # Signature verification tests (M2)
│   │   └── ignition/                     # Or plain deploy scripts
│   │
│   ├── shared/                   # ── Generated / shared types ──
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── abis/                     # ABIs exported after compile
│   │   │   │   ├── JobContract.ts
│   │   │   │   ├── EvaluatorModule.ts
│   │   │   │   ├── IdentityRegistry.ts
│   │   │   │   └── ReputationRegistry.ts
│   │   │   ├── addresses.ts              # Deployed addresses (written by deploy.ts)
│   │   │   ├── types.ts                  # Job, Agent, JobState enums
│   │   │   └── constants.ts              # Chain ID, decimals, timeout blocks
│   │   └── index.ts
│   │
│   ├── web/                      # ── Member 3 ──
│   │   ├── package.json
│   │   ├── next.config.js
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                  # Dashboard: both agent cards
│   │   │   ├── jobs/
│   │   │   │   ├── page.tsx              # Job list + states
│   │   │   │   └── [id]/page.tsx         # Job detail + timeline
│   │   │   ├── agents/[address]/page.tsx # Agent profile + reputation
│   │   │   └── api/                      # ── Member 4 (API routes live here) ──
│   │   │       ├── agents/route.ts       # GET agents from Postgres
│   │   │       ├── jobs/route.ts         # GET jobs + events from Postgres
│   │   │       └── events/route.ts       # GET recent events feed
│   │   ├── components/
│   │   │   ├── AgentCard.tsx             # Identity, reputation, balance
│   │   │   ├── JobStateBadge.tsx         # Open/Funded/Submitted/Terminal
│   │   │   ├── TxFeed.tsx                # Live transaction feed
│   │   │   └── CreateJobForm.tsx
│   │   ├── lib/
│   │   │   ├── viem.ts                   # Public + wallet clients → Hardhat node
│   │   │   ├── contracts.ts              # Typed contract helpers (uses shared/)
│   │   │   └── db.ts                     # Postgres pool (used by API routes)
│   │   └── hooks/
│   │       ├── useJobEvents.ts           # watchContractEvent subscriptions
│   │       └── useAgentData.ts
│   │
│   ├── agents/                   # ── Member 4 ──
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── agent-a/
│   │   │   │   ├── index.ts              # Entry: orchestrates client flow
│   │   │   │   ├── hire.ts               # Call B's endpoint, read 402, createJob
│   │   │   │   ├── review.ts             # Fetch deliverable, structural check
│   │   │   │   └── approve.ts            # Sign approval, submit to evaluator
│   │   │   ├── agent-b/
│   │   │   │   ├── index.ts              # Entry: listen + serve
│   │   │   │   ├── server.ts             # HTTP server w/ hardcoded 402 response
│   │   │   │   ├── worker.ts             # Listen Funded events, run task
│   │   │   │   └── llm.ts                # LLM API call (task execution)
│   │   │   └── lib/
│   │   │       ├── wallet.ts             # viem wallet clients per agent
│   │   │       └── hash.ts               # keccak256 helpers
│   │   └── .env.example                  # LLM API key, agent private keys
│   │
│   └── indexer/                  # ── Member 4 ──
│       ├── package.json
│       ├── src/
│       │   ├── index.ts                  # watchContractEvent → Postgres upsert
│       │   ├── handlers/
│       │   │   ├── jobEvents.ts          # JobCreated/Funded/Submitted/Completed
│       │   │   └── registryEvents.ts     # AgentRegistered, ReputationUpdated
│       │   └── db/
│       │       ├── schema.sql            # agents, jobs, events tables
│       │       └── client.ts
│       └── .env.example                  # DATABASE_URL
│
└── scripts/
    ├── dev.sh                            # One command: node + deploy + seed + indexer + web
    └── demo-reset.sh                     # Kill node, restart, redeploy, reseed
```

---

## 2. Workspace Configuration

Root `package.json` using npm workspaces (no extra tooling needed):

```json
{
  "name": "agent-rail",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "chain": "npm -w packages/contracts run node",
    "deploy": "npm -w packages/contracts run deploy",
    "seed": "npm -w packages/contracts run seed",
    "indexer": "npm -w packages/indexer run start",
    "web": "npm -w packages/web run dev",
    "agent:a": "npm -w packages/agents run start:a",
    "agent:b": "npm -w packages/agents run start:b",
    "test": "npm -w packages/contracts run test"
  }
}
```

Turborepo is optional — for a 2-week university project, plain npm workspaces is enough. Add turbo only if build caching becomes painful.

---

## 3. Package Dependency Graph

```
contracts  ──compiles──►  shared (ABIs + addresses)
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
             web          agents         indexer
              │                             │
              └──────── Postgres ◄──────────┘
                    (web reads via API routes,
                     indexer writes events)
```

Rules:
- `shared` is the ONLY bridge between contracts and consumers. No package imports from `contracts` directly.
- `web` never talks to Postgres from client components — only through its own API routes.
- `agents` and `indexer` talk to the chain via viem using ABIs from `shared`.

---

## 4. Data Flow (runtime)

```
1. Hardhat node runs at localhost:8545
2. deploy.ts deploys contracts → writes addresses into shared/addresses.ts
3. seed.ts registers Agent A + B, mints MockUSDC to both
4. indexer subscribes to all contract events → upserts into Postgres
5. web reads live chain state via viem AND indexed history via /api routes
6. agent-b runs an HTTP server (402 response) + chain listener
7. agent-a hires: HTTP → createJob → (B works, submits) → review → sign → settle
```

---

## 5. Database Schema (packages/indexer/src/db/schema.sql)

```sql
CREATE TABLE agents (
  address        TEXT PRIMARY KEY,
  token_id       INTEGER,
  name           TEXT,
  reputation     INTEGER DEFAULT 0,
  registered_at  TIMESTAMPTZ
);

CREATE TABLE jobs (
  id             INTEGER PRIMARY KEY,        -- on-chain job id
  client         TEXT REFERENCES agents(address),
  provider       TEXT REFERENCES agents(address),
  amount         NUMERIC,                    -- USDC (6 decimals)
  state          TEXT,                       -- Open|Funded|Submitted|Terminal
  deliverable_hash TEXT,
  created_block  BIGINT,
  updated_at     TIMESTAMPTZ
);

CREATE TABLE events (
  id             SERIAL PRIMARY KEY,
  contract       TEXT,
  event_name     TEXT,
  job_id         INTEGER,
  tx_hash        TEXT,
  block_number   BIGINT,
  args           JSONB,
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

Postgres is a **read cache** — the chain is the source of truth. If DB and chain disagree, the chain wins. This satisfies the assignment's "link frontend to local database" requirement while keeping the architecture honest.

---

## 6. Environment Variables (.env.example)

```
# chain
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337

# agents (Hardhat default accounts — safe for local only)
AGENT_A_PRIVATE_KEY=0xac09...
AGENT_B_PRIVATE_KEY=0x59c6...

# llm
LLM_API_KEY=sk-...
LLM_MODEL=claude-haiku-4-5

# database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/agentrail

# agent-b http server
AGENT_B_PORT=4020
AGENT_B_PRICE_USDC=10
```

---

## 7. Member Ownership Map

| Package | Owner | Depends on |
|---|---|---|
| `packages/contracts` (JobContract, MockUSDC, deploy) | Member 1 | — |
| `packages/contracts` (registries, EvaluatorModule) | Member 2 | M1's JobContract interface |
| `packages/shared` | M1+M2 generate, all consume | contracts compile |
| `packages/web` (UI, viem, hooks) | Member 3 | shared |
| `packages/web/app/api` + `packages/indexer` + `packages/agents` | Member 4 | shared, Postgres |
| `scripts/` (dev.sh, demo-reset.sh) | Member 4 | everything |

Coordination rule: contract function signatures agreed and `shared/` populated with stub ABIs **before** Members 3–4 write any code against them.

---

## 8. Boot Sequence (scripts/dev.sh)

```bash
#!/bin/bash
# 1. Start local chain
npm run chain &
sleep 3
# 2. Deploy + seed
npm run deploy && npm run seed
# 3. Start indexer
npm run indexer &
# 4. Start Agent B (server + listener)
npm run agent:b &
# 5. Start frontend
npm run web
```

`demo-reset.sh` = kill all background processes, restart from step 1. One command back to a clean demo state.

---

## 9. What Deliberately Isn't Here

- No ERC-4337 bundler / EntryPoint — direct contract calls (per proposal scope)
- No real x402 negotiation — hardcoded 402 JSON response in agent-b/server.ts
- No testnet deployment config — Hardhat local only (assignment requirement)
- No CI/CD — out of scope for 2 weeks
- No contract upgradeability — deploy-once for demo

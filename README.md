# AgentRail

Decentralised AI agent payment settlement DApp — **CT124-3-3 Group 7**.

Two AI agents transact autonomously: a client agent hires a provider agent, the
provider does the work, and payment settles on-chain through an escrowed job
contract with on-chain identity, reputation, and signed evaluation. The chain is
the source of truth; a Postgres cache serves indexed history to the frontend.

**Stack:** Solidity + Hardhat · Next.js (App Router) · PostgreSQL · viem · Node.js agents

## Monorepo layout

```
packages/
  contracts/   Solidity contracts, deploy + seed scripts, tests (Hardhat)
  shared/      ABIs, deployed addresses, shared types + constants
  web/         Next.js dashboard + API routes
  agents/      Agent A (client) and Agent B (provider) runtimes
  indexer/     Chain-event → Postgres indexer
scripts/       dev.sh (boot everything), demo-reset.sh
```

See [`agentrail-architecture.md`](./agentrail-architecture.md) for the full plan
and [`CLAUDE.md`](./CLAUDE.md) for engineering conventions.

## Quickstart

```bash
# 0. prerequisites: Node 20+, a local Postgres with an `agentrail` database
cp .env.example .env            # fill in LLM_API_KEY etc.
npm install                     # installs all workspaces

# 1. create the database schema
psql "$DATABASE_URL" -f packages/indexer/src/db/schema.sql

# 2. boot the whole stack (chain + deploy + seed + indexer + agent-b + web)
npm run dev
```

Or run pieces individually:

```bash
npm run chain      # local Hardhat node at :8545
npm run deploy     # deploy contracts, write shared/src/addresses.ts
npm run seed       # register agents, mint MockUSDC
npm run indexer    # start the event indexer
npm run agent:b    # start Agent B (402 server + chain listener)
npm run agent:a    # run Agent A's hire → review → settle flow
npm run web        # Next.js dev server at :3000
npm test           # contract tests
```

## Reset to a clean demo state

```bash
npm run demo:reset
```

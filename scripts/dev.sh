#!/bin/bash
# Boot the whole AgentRail stack from a clean state.
# Usage: npm run dev   (from the repo root)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

pids=()
cleanup() {
  echo "[dev] shutting down…"
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

# 1. Start Postgres and apply the schema. Must precede the indexer, which
#    writes on its first event and dies if the tables are missing.
echo "[dev] starting database…"
npm run db:setup

# 2. Start the local chain
echo "[dev] starting Hardhat node…"
npm run chain &
pids+=($!)
sleep 3

# 3. Deploy + seed
echo "[dev] deploying + seeding…"
npm run deploy
npm run seed

# 4. Start the indexer
echo "[dev] starting indexer…"
npm run indexer &
pids+=($!)

# 5. Start Agent B (402 server + chain listener)
echo "[dev] starting agent-b…"
npm run agent:b &
pids+=($!)

# 6. Start Agent C (evaluator)
echo "[dev] starting agent-c…"
npm run agent:c &
pids+=($!)

# 7. Start the frontend (foreground — Ctrl-C stops everything)
echo "[dev] starting web…"
npm run web

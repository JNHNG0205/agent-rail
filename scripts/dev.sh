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

# 1. Start the local chain
echo "[dev] starting Hardhat node…"
npm run chain &
pids+=($!)
sleep 3

# 2. Deploy + seed
echo "[dev] deploying + seeding…"
npm run deploy
npm run seed

# 3. Start the indexer
echo "[dev] starting indexer…"
npm run indexer &
pids+=($!)

# 4. Start Agent B (402 server + chain listener)
echo "[dev] starting agent-b…"
npm run agent:b &
pids+=($!)

# 5. Start the frontend (foreground — Ctrl-C stops everything)
echo "[dev] starting web…"
npm run web

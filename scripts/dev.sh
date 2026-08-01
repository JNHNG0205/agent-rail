#!/bin/bash
# Boot the whole AgentRail stack from a clean state.
# Usage: npm run dev   (from the repo root)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# This script IS the local stack: it starts a Hardhat node and deploys to it, so
# every process it starts must follow that chain. Exporting here rather than
# trusting .env is deliberate — dotenv does not override variables already in the
# environment, so this wins. Without it, a .env left on CHAIN_ID=84532 after
# testnet work boots a local chain while the agents watch Base Sepolia, and the
# demo simply never progresses past "funded" with no error anywhere.
export CHAIN_ID=31337
export RPC_URL=http://127.0.0.1:8545

pids=()
cleanup() {
  echo "[dev] shutting down…"
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

# 1. Start Postgres. Must precede the indexer — Ponder creates its own tables
#    on startup but needs a database to connect to first.
echo "[dev] starting database…"
npm run db:setup

# 2. Drop the indexed data. The Hardhat node below starts from genesis every run,
#    so yesterday's rows describe contracts that no longer exist — and Ponder
#    refuses to start against a schema a different deployment wrote ("Schema
#    public was previously used by a different Ponder app"). Leaving it also lets
#    the API serve a previous run's jobs with a 200 while the indexer is dead,
#    which looks like working software.
echo "[dev] clearing indexed data…"
docker exec agentrail-db psql -U postgres -d agentrail -q \
  -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

# 3. Start the local chain and wait for it to answer, rather than sleeping a
#    fixed guess — a slow machine would otherwise deploy into a node that is not
#    listening yet.
echo "[dev] starting Hardhat node…"
npm run chain &
pids+=($!)

for _ in $(seq 1 40); do
  if curl -s -m 2 -X POST "$RPC_URL" -H 'content-type: application/json' \
      -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | grep -q 0x7a69; then
    break
  fi
  sleep 0.5
done

if ! curl -s -m 2 -X POST "$RPC_URL" -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | grep -q 0x7a69; then
  echo "[dev] Hardhat node did not come up on $RPC_URL" >&2
  exit 1
fi

# 4. Deploy + seed
echo "[dev] deploying + seeding…"
npm run deploy
npm run seed

# 5. Start the indexer, then confirm it survived. It exits on a schema clash
#    instead of retrying, and a dead indexer is invisible from the UI — the API
#    keeps answering 200 from whatever is already in Postgres.
echo "[dev] starting indexer…"
npm run indexer &
indexer_pid=$!
pids+=($indexer_pid)

sleep 6
if ! kill -0 "$indexer_pid" 2>/dev/null; then
  echo "[dev] the indexer exited during startup — the UI would show stale or empty data." >&2
  echo "[dev] run 'npm run indexer' on its own to see why." >&2
  exit 1
fi

# 6. Start Agent B (402 server + chain listener)
echo "[dev] starting agent-b…"
npm run agent:b &
pids+=($!)

# 7. Start Agent C (evaluator)
echo "[dev] starting agent-c…"
npm run agent:c &
pids+=($!)

# 8. Start the frontend (foreground — Ctrl-C stops everything)
echo "[dev] starting web…"
echo "[dev] ready. Run 'npm run agent:a' in another terminal to commission a job."
npm run web

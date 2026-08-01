#!/bin/bash
# Boot the whole AgentRail stack.
#
#   npm run dev                -> local Hardhat chain, rebuilt from genesis
#   npm run dev:base-sepolia   -> the deployed Base Sepolia contracts
#
# The two differ only in how the chain is prepared. Locally the script creates
# everything; on testnet the contracts, registrations and gas already exist and
# the script's job is to confirm them and refuse to start if they are wrong.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGET="${1:-local}"

# Exported rather than left to .env because dotenv does not override a variable
# that is already set, so this wins over whatever a previous session left behind.
# Without it, `npm run dev` after any testnet work booted a local chain while the
# agents watched Base Sepolia — no error, the demo simply never progressed.
case "$TARGET" in
  local)
    export CHAIN_ID=31337
    export RPC_URL=http://127.0.0.1:8545
    ;;
  base-sepolia)
    export CHAIN_ID=84532
    # Every package resolves its endpoint by chain, but only the root .env
    # carries the private one. Lift it into the environment so the agents, the
    # indexer and the web app share it, instead of each independently falling
    # back to the public pool — which rate-limits the indexer's backfill.
    if [ -z "${BASE_SEPOLIA_RPC_URL:-}" ] && [ -f .env ]; then
      BASE_SEPOLIA_RPC_URL="$(grep -E '^BASE_SEPOLIA_RPC_URL=.' .env | head -1 | cut -d= -f2- || true)"
    fi
    export BASE_SEPOLIA_RPC_URL
    ;;
  *)
    echo "usage: bash scripts/dev.sh [local|base-sepolia]" >&2
    exit 1
    ;;
esac

pids=()
cleanup() {
  echo "[dev] shutting down…"
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

# 1. Start Postgres. Must precede the indexer — Ponder creates its own tables on
#    startup but needs a database to connect to first.
echo "[dev] starting database…"
npm run db:setup

if [ "$TARGET" = "local" ]; then
  # 2. Drop the indexed data. The Hardhat node below starts from genesis every
  #    run, so yesterday's rows describe contracts that no longer exist — and
  #    Ponder refuses to start against a schema a different deployment wrote.
  #    Leaving it also lets the API serve a previous run's jobs with a 200 while
  #    the indexer is dead, which looks like working software.
  echo "[dev] clearing indexed data…"
  docker exec agentrail-db psql -U postgres -d agentrail -q \
    -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

  # 3. Start the local chain and wait for it to answer, rather than sleeping a
  #    fixed guess — a slow machine would otherwise deploy into a node that is
  #    not listening yet.
  echo "[dev] starting Hardhat node…"
  npm run chain &
  pids+=($!)

  chain_up=""
  for _ in $(seq 1 40); do
    if curl -s -m 2 -X POST "$RPC_URL" -H 'content-type: application/json' \
        -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | grep -q 0x7a69; then
      chain_up=yes
      break
    fi
    sleep 0.5
  done

  if [ -z "$chain_up" ]; then
    echo "[dev] Hardhat node did not come up on $RPC_URL" >&2
    exit 1
  fi

  # 4. Deploy + seed
  echo "[dev] deploying + seeding…"
  npm run deploy
  npm run seed
else
  # 2-4. Nothing to create. Verify instead: the contracts must exist, the agents
  #      must be registered and hold gas. Each of those fails deep inside an
  #      agent with a message about something else, so it is worth one check.
  #      The indexed data stays — the deployment has not changed, so Ponder
  #      resumes where it left off rather than refetching 86k blocks.
  echo "[dev] checking Base Sepolia…"
  npx tsx scripts/preflight.ts
fi

# 5. Start the indexer, then confirm it survived. It exits on a schema clash
#    instead of retrying, and a dead indexer is invisible from the UI — the API
#    keeps answering 200 from whatever is already in Postgres.
echo "[dev] starting indexer…"
npm run indexer &
indexer_pid=$!
pids+=($indexer_pid)

sleep 8
if ! kill -0 "$indexer_pid" 2>/dev/null; then
  echo "[dev] the indexer exited during startup — the UI would show stale or empty data." >&2
  echo "[dev] run 'npm run indexer' on its own to see why." >&2
  echo "[dev] if it reports a schema clash after a redeploy, run 'npm run db:reset' first." >&2
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

# Name the matching command explicitly. The agents resolve their chain from
# packages/agents/.env when started by hand, so a plain `npm run agent:a` next to
# a testnet stack talks to 127.0.0.1:8545 and fails on a refused connection —
# after it has already fetched the 402 quote, which makes it look like a chain
# problem rather than the wrong chain.
if [ "$TARGET" = "local" ]; then
  hire_command="npm run agent:a"
else
  hire_command="npm run agent:a:base-sepolia"
fi

echo "[dev] ready on ${TARGET}. Run '${hire_command}' in another terminal to commission a job."
npm run web

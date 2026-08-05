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
    # Only the root .env carries the endpoint, so lift it into the environment
    # for the processes started below. The indexer reads its own variable and so
    # is unaffected — see ponder.config.ts for why that separation is kept even
    # though one provider currently serves everything.
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

# 2. Decide whether the indexed data can be kept.
#
#    Locally it never can: the Hardhat node starts from genesis every run, so the
#    rows describe contracts that no longer exist. On testnet it usually can, and
#    keeping it is the difference between resuming and refetching 86k blocks.
#
#    The exception is switching chains. Ponder refuses to start against a schema
#    another app wrote, and says so as "Schema public was previously used by a
#    different Ponder app" — which names neither the chain switch that caused it
#    nor the fix. Detecting it here means the switch just works.
drop_indexed=""
if [ "$TARGET" = "local" ]; then
  drop_indexed="the local chain restarts from genesis"
else
  indexed_chain="$(docker exec agentrail-db psql -U postgres -d agentrail -t -A \
    -c "SELECT chain_id FROM event LIMIT 1;" 2>/dev/null | tr -d '[:space:]' || true)"
  if [ -n "$indexed_chain" ] && [ "$indexed_chain" != "$CHAIN_ID" ]; then
    drop_indexed="indexed data is for chain ${indexed_chain}, target is ${CHAIN_ID}"
  fi
fi

if [ -n "$drop_indexed" ]; then
  # Leaving stale rows also lets the API answer 200 from a previous run while the
  # indexer is dead, which looks like working software.
  echo "[dev] clearing indexed data — ${drop_indexed}…"
  docker exec agentrail-db psql -U postgres -d agentrail -q \
    -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
fi

if [ "$TARGET" = "local" ]; then

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

# 6. Start the agent runtime, and confirm it stayed up.
#
#    This hosts every agent a user creates and serves the directory they find
#    each other through. The whole UI goes through it — the assistant, the chat,
#    hiring, the registry — so without it those screens answer 503 while the rest
#    of the stack looks healthy. It used to be missing here entirely, which meant
#    the one command anyone would run did not start the product.
#
#    It also creates the default client agent on first run, which costs a few
#    on-chain calls, so it gets longer than the indexer to come up.
echo "[dev] starting agent runtime…"
npm run runtime &
runtime_pid=$!
pids+=($runtime_pid)

sleep 12
if ! kill -0 "$runtime_pid" 2>/dev/null; then
  echo "[dev] the agent runtime exited during startup — the assistant and registry would be dead." >&2
  echo "[dev] run 'npm run runtime' on its own to see why." >&2
  exit 1
fi

# 7. Start Agent C (evaluator)
#
#    Not hosted by the runtime, deliberately. A referee that a party to the trade
#    could create would be no referee, so it runs on its own key and its own
#    process.
echo "[dev] starting agent-c…"
npm run agent:c &
pids+=($!)

# 8. Start the frontend (foreground — Ctrl-C stops everything)
echo "[dev] starting web…"
echo "[dev] ready on ${TARGET} — open http://localhost:3000 and talk to your assistant."
npm run web

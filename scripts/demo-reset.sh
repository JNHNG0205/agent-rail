#!/bin/bash
# Kill any running stack processes and boot fresh — one command back to a clean
# demo state.
#   npm run demo:reset                  -> local
#   npm run demo:reset base-sepolia     -> the deployed testnet contracts
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[demo-reset] killing stray processes…"

# Patterns must match the command line as it actually runs, which is what the
# workspace script execs — `tsx src/agent-b/index.ts`, with the package as its
# working directory. The earlier patterns spelled out the full repo path
# ("packages/agents/src/agent-b/index.ts") and so matched nothing at all: a reset
# left the previous agents alive, the new agent-b could not bind :4020, and two
# evaluators raced to sign the same job.
patterns=(
  "hardhat node"
  "tsx src/agent-a/index.ts"
  "tsx src/agent-b/index.ts"
  "tsx src/agent-c/index.ts"
  "ponder"
  "next dev"
)

# Tested with `if pgrep`, not by capturing a count: pgrep exits 1 when nothing
# matches, and under `set -o pipefail` that status propagates out of a command
# substitution and `set -e` ends the script — silently, on the first pattern that
# happens to have nothing running.
for pattern in "${patterns[@]}"; do
  if pgrep -f "$pattern" >/dev/null 2>&1; then
    echo "  killing ${pattern}"
    pkill -f "$pattern" || true
  fi
done

# Let the ports release before the new stack claims them.
sleep 2

for port in 8545 4020 3000; do
  if lsof -ti tcp:"$port" >/dev/null 2>&1; then
    echo "  port ${port} still held, forcing…"
    lsof -ti tcp:"$port" | xargs kill -9 2>/dev/null || true
  fi
done

echo "[demo-reset] restarting stack…"
# dev.sh handles the database itself: it clears the indexed data for a local run
# (the chain restarts from genesis) and keeps it for testnet (the deployment is
# unchanged, so re-syncing 86k blocks would be pure waste).
exec bash scripts/dev.sh "${1:-local}"

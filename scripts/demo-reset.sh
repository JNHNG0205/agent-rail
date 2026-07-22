#!/bin/bash
# Kill any running stack processes and boot fresh — one command back to a clean
# demo state. Usage: npm run demo:reset
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[demo-reset] killing stray processes…"
# Hardhat node
pkill -f "hardhat node" 2>/dev/null || true
# indexer / agents (tsx entry points)
pkill -f "packages/indexer/src/index.ts" 2>/dev/null || true
pkill -f "packages/agents/src/agent-a/index.ts" 2>/dev/null || true
pkill -f "packages/agents/src/agent-b/index.ts" 2>/dev/null || true
# next dev
pkill -f "next dev" 2>/dev/null || true

sleep 1
echo "[demo-reset] restarting stack…"
exec bash scripts/dev.sh

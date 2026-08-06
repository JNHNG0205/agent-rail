#!/bin/bash
# Bring up Postgres and wait until it is ready to accept connections.
# Idempotent — safe to re-run. Usage: npm run db:setup
#
# There is no schema to apply: Ponder owns the tables and creates them from
# packages/indexer/ponder.schema.ts on startup. This script only has to make
# sure a healthy database is listening before the indexer tries to connect.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! docker info >/dev/null 2>&1; then
  echo "[db] Docker is not running. Start Docker Desktop and retry." >&2
  exit 1
fi

echo "[db] starting postgres…"
docker compose up -d postgres

echo "[db] waiting for readiness…"
for _ in $(seq 1 30); do
  if [ "$(docker inspect -f '{{.State.Health.Status}}' agentrail-db 2>/dev/null)" = "healthy" ]; then
    break
  fi
  sleep 1
done

if [ "$(docker inspect -f '{{.State.Health.Status}}' agentrail-db 2>/dev/null)" != "healthy" ]; then
  echo "[db] postgres did not become healthy in 30s. Check: docker compose logs postgres" >&2
  exit 1
fi

echo "[db] ready — Ponder will create its tables on first start."

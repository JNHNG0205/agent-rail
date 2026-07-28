#!/bin/bash
# Bring up Postgres and apply the indexer schema. Idempotent — safe to re-run.
# Usage: npm run db:setup
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SCHEMA="packages/indexer/src/db/schema.sql"

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

echo "[db] applying ${SCHEMA}…"
docker exec -i agentrail-db psql -q -U postgres -d agentrail < "$SCHEMA"

echo "[db] ready — $(docker exec agentrail-db psql -tAU postgres -d agentrail -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'") tables in agentrail"

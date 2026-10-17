#!/usr/bin/env bash
# Apply migrations to the configured Postgres database.
# Usage: ./scripts/migrate.sh [up|down]
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$DIR/migrations"
DIRECTION="${1:-up}"

# Load env from project root .env
PROJECT_ROOT="$(cd "$DIR/.." && pwd)"
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source /dev/stdin < <(grep -E '^[A-Z]' "$PROJECT_ROOT/.env" | sed 's/=\(.*\)/="\1"/')
  set +a
fi

PGHOST="${POSTGRES_HOST:-localhost}"
PGPORT="${POSTGRES_PORT:-5432}"
PGDATABASE="${POSTGRES_DB:-ctfoj}"
PGUSER="${POSTGRES_USER:-ctfoj}"
PGPASSWORD="${POSTGRES_PASSWORD:-change_me}"
export PGPASSWORD

SCHEMA_TABLE="schema_migrations"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 <<EOF
CREATE TABLE IF NOT EXISTS ${SCHEMA_TABLE} (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
EOF

if [ "$DIRECTION" = "up" ]; then
  for f in $(ls -1 "$MIGRATIONS_DIR"/*.up.sql 2>/dev/null | sort); do
    name="$(basename "$f")"
    applied=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc \
      "SELECT 1 FROM ${SCHEMA_TABLE} WHERE name='$name'")
    if [ "$applied" = "1" ]; then
      echo "skip (already applied): $name"
      continue
    fi
    echo "applying: $name"
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f "$f"
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc \
      "INSERT INTO ${SCHEMA_TABLE}(name) VALUES ('$name')"
  done
elif [ "$DIRECTION" = "down" ]; then
  for f in $(ls -1 "$MIGRATIONS_DIR"/*.down.sql 2>/dev/null | sort -r); do
    name="$(basename "$f" | sed 's/\.down\.sql$/.up.sql/')"
    applied=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc \
      "SELECT 1 FROM ${SCHEMA_TABLE} WHERE name='$name'")
    if [ "$applied" != "1" ]; then
      echo "skip (not applied): $name"
      continue
    fi
    echo "rolling back: $name"
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f "$f"
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc \
      "DELETE FROM ${SCHEMA_TABLE} WHERE name='$name'"
  done
else
  echo "Unknown direction: $DIRECTION"
  exit 1
fi

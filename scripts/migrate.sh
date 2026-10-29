#!/usr/bin/env bash
# Apply pending SQL migrations exactly once, tracked in schema_migrations.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASELINE_EXISTING=0
for arg in "$@"; do
  case "$arg" in
    --baseline-existing) BASELINE_EXISTING=1 ;;
    -h|--help)
      echo "Usage: $0 [--baseline-existing]"
      echo "  --baseline-existing  Existing database without schema_migrations:"
      echo "                       mark all current migrations as applied."
      exit 0
      ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

compose() { docker compose "$@"; }

psql_shell() {
  compose exec -T postgres sh -c "psql -X -q -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" $*"
}

psql_scalar() {
  compose exec -T postgres sh -c "psql -X -At -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -c \"$1\""
}

echo "==> waiting for postgres"
for _ in $(seq 1 60); do
  if compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
if ! compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
  echo "postgres did not become ready" >&2
  exit 1
fi

psql_shell "-c \"CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())\"" >/dev/null

APPLIED="$(psql_scalar 'SELECT name FROM schema_migrations ORDER BY name')"
USERS_EXIST="$(psql_scalar "SELECT to_regclass('public.users') IS NOT NULL")"

if [[ "$USERS_EXIST" == "t" && -z "$APPLIED" ]]; then
  echo "!! Existing database detected without migration tracking."
  if [[ "$BASELINE_EXISTING" -eq 0 ]]; then
    if [[ -t 0 ]]; then
      read -r -p "Mark all current migrations as applied (no SQL executed)? [y/N] " answer
      [[ "$answer" == "y" || "$answer" == "Y" ]] || {
        echo "Aborted. Re-run with --baseline-existing if the schema is current." >&2
        exit 1
      }
    else
      echo "Re-run with --baseline-existing if the schema is current." >&2
      exit 1
    fi
  fi
  for f in backend/migrations/*.up.sql; do
    name="$(basename "$f")"
    psql_shell "-c \"INSERT INTO schema_migrations (name) VALUES ('$name') ON CONFLICT DO NOTHING\"" >/dev/null
  done
  echo "==> baselined $(ls backend/migrations/*.up.sql | wc -l | tr -d ' ') migrations"
  exit 0
fi

pending=0
for f in backend/migrations/*.up.sql; do
  name="$(basename "$f")"
  if printf '%s\n' "$APPLIED" | grep -qxF "$name"; then
    continue
  fi
  echo "==> applying $name"
  {
    printf 'BEGIN;\n'
    cat "$f"
    printf "\nINSERT INTO schema_migrations (name) VALUES ('%s');\n" "$name"
    printf 'COMMIT;\n'
  } | compose exec -T postgres sh -c 'psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f -'
  pending=$((pending + 1))
done

if [[ "$pending" -eq 0 ]]; then
  echo "==> database is up to date"
else
  echo "==> applied $pending migration(s)"
fi

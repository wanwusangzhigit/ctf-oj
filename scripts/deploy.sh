#!/usr/bin/env bash
# One-command deployment: secrets, schema, images, health check.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NO_BUILD=0
SKIP_MIGRATE=0
for arg in "$@"; do
  case "$arg" in
    --no-build) NO_BUILD=1 ;;
    --skip-migrate) SKIP_MIGRATE=1 ;;
    -h|--help)
      cat <<'USAGE'
Usage: scripts/deploy.sh [--no-build] [--skip-migrate]

  --no-build      Reuse existing images instead of rebuilding.
  --skip-migrate  Do not apply pending database migrations.
USAGE
      exit 0
      ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose v2 is required" >&2
  exit 1
fi

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
  fi
}

replace_secret() {
  local key="$1" value="$2"
  sed -i.bak "s|^${key}=.*|${key}=${value}|" .env
  rm -f .env.bak
}

CREATED_ENV=0
if [[ ! -f .env ]]; then
  echo "==> creating .env from .env.example"
  cp .env.example .env
  CREATED_ENV=1
fi

has_default() { grep -qE "^$1=(change_me_in_production|replace_with_a_long_random_string)$" .env; }

if [[ "$CREATED_ENV" -eq 1 ]]; then
  echo "==> generating secrets"
  replace_secret POSTGRES_PASSWORD "$(gen_secret)"
  replace_secret POSTGRES_ROOT_PASSWORD "$(gen_secret)"
  replace_secret BACKEND_JWT_SECRET "$(gen_secret)"
  chmod 600 .env
else
  if has_default BACKEND_JWT_SECRET; then
    echo "==> rotating default JWT secret"
    replace_secret BACKEND_JWT_SECRET "$(gen_secret)"
    chmod 600 .env
  fi
  if has_default POSTGRES_PASSWORD || has_default POSTGRES_ROOT_PASSWORD; then
    PROJECT="$(docker compose config --format json 2>/dev/null | sed -n 's/.*"name": *"\([^"]*\)".*/\1/p' | head -n1)"
    if [[ -n "$PROJECT" ]] && docker volume ls --format '{{.Name}}' | grep -qx "${PROJECT}_pg-data"; then
      echo "!! Existing postgres volume uses the default password; not rotating it automatically."
      echo "   Change it manually (ALTER USER) and update POSTGRES_PASSWORD in .env."
    else
      echo "==> rotating default database password"
      replace_secret POSTGRES_PASSWORD "$(gen_secret)"
      replace_secret POSTGRES_ROOT_PASSWORD "$(gen_secret)"
      chmod 600 .env
    fi
  fi
fi

if ! grep -q '^PUBLIC_HTTP_PORT=' .env; then
  echo 'PUBLIC_HTTP_PORT=8080' >> .env
fi

docker compose config -q

echo "==> starting postgres and redis"
docker compose up -d postgres redis

if [[ "$SKIP_MIGRATE" -eq 0 ]]; then
  echo "==> applying migrations"
  ./scripts/migrate.sh
fi

if [[ "$NO_BUILD" -eq 1 ]]; then
  echo "==> starting stack"
  docker compose up -d
else
  echo "==> building and starting stack"
  docker compose up -d --build
fi

PORT="$(grep '^PUBLIC_HTTP_PORT=' .env | tail -n1 | cut -d= -f2)"
PORT="${PORT:-8080}"
URL="http://127.0.0.1:${PORT}"
health() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "${URL}/api/v1/health" >/dev/null 2>&1
  else
    wget -qO- "${URL}/api/v1/health" >/dev/null 2>&1
  fi
}

echo "==> waiting for ${URL}/api/v1/health"
for _ in $(seq 1 90); do
  if health; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "${ready:-0}" -ne 1 ]]; then
  echo "health check failed; inspect with: docker compose logs --tail=200" >&2
  exit 1
fi

cat <<INFO

Deployment ready: ${URL}

Next steps:
  1. Register the first account in the browser.
  2. Promote it to administrator:
       docker compose exec -T postgres sh -c 'psql -U "\$POSTGRES_USER" -d "\$POSTGRES_DB" -c "UPDATE users SET role='"'"'admin'"'"' WHERE username='"'"'YOUR_NAME'"'"';"'
  3. For remote instances, set BACKEND_INSTANCE_PUBLIC_HOST in .env to the public IP/hostname.

Useful commands:
  docker compose logs -f --tail=200
  make backup
INFO

#!/usr/bin/env bash
# Import the sample challenge bundle through the admin API.
#
# This is opt-in: migrations never seed sample data, so a fresh install starts
# empty and only this script (or the admin UI) creates demo content. Flags in
# the bundle are published examples — change or delete them before production.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASE_URL="${CTFOJ_URL:-http://localhost:8080}"
ACCOUNT="${CTFOJ_ADMIN_ACCOUNT:-}"
PASSWORD="${CTFOJ_ADMIN_PASSWORD:-}"
BUNDLE="$ROOT/deploy/demo/challenges.json"

usage() {
  cat <<'EOF'
Usage: scripts/seed-demo.sh [options]

Imports deploy/demo/challenges.json through POST /api/v1/admin/import/challenges.
Existing challenges (matched by title) are skipped, so re-running is safe.

Options:
  --url URL            Base URL (default: $CTFOJ_URL or http://localhost:8080)
  --account NAME       Admin account (default: $CTFOJ_ADMIN_ACCOUNT)
  --password PASS      Admin password (default: $CTFOJ_ADMIN_PASSWORD)
  --bundle PATH        Bundle file (default: deploy/demo/challenges.json)
  -h, --help           Show this help

The account needs the challenge-manage permission. The password is never
written to disk; prefer the environment variables over the flag.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) BASE_URL="${2:?missing value}"; shift 2 ;;
    --account) ACCOUNT="${2:?missing value}"; shift 2 ;;
    --password) PASSWORD="${2:?missing value}"; shift 2 ;;
    --bundle) BUNDLE="${2:?missing value}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

BASE_URL="${BASE_URL%/}"
command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }
[[ -f "$BUNDLE" ]] || { echo "bundle not found: $BUNDLE" >&2; exit 1; }
[[ -n "$ACCOUNT" && -n "$PASSWORD" ]] || {
  echo "admin credentials required: pass --account/--password or set CTFOJ_ADMIN_ACCOUNT/CTFOJ_ADMIN_PASSWORD" >&2
  exit 2
}

json_str() {
  python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1"
}

echo "==> signing in as $ACCOUNT at $BASE_URL"
LOGIN_BODY=$(printf '{"account":%s,"password":%s}' "$(json_str "$ACCOUNT")" "$(json_str "$PASSWORD")")

# The API authenticates with HttpOnly cookies, so keep a jar for the import
# request. A Bearer token is used too when the response includes one.
COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR"' EXIT

LOGIN_JSON=$(curl -fsS -c "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  --data "$LOGIN_BODY")

TOKEN=$(printf '%s' "$LOGIN_JSON" | python3 -c '
import json,sys
body=json.load(sys.stdin)
if body.get("code") not in (0, None):
    sys.exit("login failed: " + str(body.get("message") or body))
data=body.get("data") or {}
print(data.get("accessToken") or "")
')

AUTH_ARGS=(-b "$COOKIE_JAR")
if [[ -n "$TOKEN" ]]; then
  AUTH_ARGS+=(-H "Authorization: Bearer $TOKEN")
fi

echo "==> importing $BUNDLE"
RESP=$(curl -fsS "${AUTH_ARGS[@]}" -X POST "$BASE_URL/api/v1/admin/import/challenges" \
  -F "file=@$BUNDLE;type=application/json")

printf '%s' "$RESP" | python3 -c '
import json,sys
body=json.load(sys.stdin)
if body.get("code") != 0:
    sys.exit("import failed: " + json.dumps(body, ensure_ascii=False))
d=body.get("data") or {}
print("    categories created: %s" % d.get("categoriesCreated",0))
print("    challenges created: %s" % d.get("challengesCreated",0))
print("    challenges skipped: %s (title already exists)" % d.get("challengesSkipped",0))
print("    challenges failed:  %s" % d.get("challengesFailed",0))
print("    hints created:      %s" % d.get("hintsCreated",0))
'
echo "==> done"

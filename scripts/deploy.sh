#!/usr/bin/env bash
# Default deployment: prepare secrets, pull the published images (falling back
# to a local build when they cannot be pulled), migrate, start, health check.
# It asks nothing. --custom walks a wizard whose answers all have flags.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
. "$ROOT/scripts/lib/messages.sh"

DEFAULT_REGISTRY='ghcr.io/wanwusangzhigit/ctf-oj'
DEFAULT_PROJECT='ctfoj'
DEFAULT_TAG='latest'
DEFAULT_PORT='8080'
DEFAULT_INSTANCE_HOST='localhost'
DEFAULT_PORT_MIN='30000'
DEFAULT_PORT_MAX='40000'
DEFAULT_PULL_TIMEOUT="${CTF_OJ_PULL_TIMEOUT:-600}"

CUSTOM=0 ASSUME_YES=0 DRY_RUN=0 SKIP_MIGRATE=0 SHOW_HELP=0
SOURCE='' PORT='' PROJECT='' REGISTRY='' TAG='' REGISTER=''
INSTANCE_HOST='' PORT_RANGE='' SECRETS='' ADMIN='' ADMIN_NOW=''
PULL_TIMEOUT=''
ENV_FILE='.env' LANG_OPT=''
LANG_CODE=zh

usage() {
  printf '%s\n' "$(t usage_head)"
  printf '\n  scripts/deploy.sh [OPTIONS]\n'
  printf '\n%s\n' "$(t usage_options)"
  local row key note
  while IFS='|' read -r row key note; do
    [[ -n "$row" ]] || continue
    printf '    %-26s %s%s\n' "$row" "$(t "$key")" "${note:+  [$note]}"
  done <<'FLAGS'
--custom, -i|flag_custom|
--yes, -y|flag_yes|
--lang {zh/en}|flag_lang|zh
--source {auto/pull/build}|flag_source|auto
--pull-timeout N|flag_pull_timeout|600
--port N|flag_port|8080
--project NAME|flag_project|ctfoj
--registry PREFIX|flag_registry|ghcr.io/<owner>/<repo>
--tag TAG|flag_tag|latest
--register {open/closed}|flag_register|open
--instance-host HOST|flag_instance_host|localhost
--instance-port-range MIN-MAX|flag_instance_ports|30000-40000
--secrets {auto/manual}|flag_secrets|auto
--admin USERNAME|flag_admin|
--env-file PATH|flag_env_file|.env
--dry-run|flag_dry_run|
--no-build|flag_no_build|
--skip-migrate|flag_skip_migrate|
-h, --help|flag_help|
FLAGS
  printf '\n%s\n' "$(t usage_examples_intro)"
  cat <<'EXAMPLES'
  scripts/deploy.sh
  scripts/deploy.sh --custom --port 8090 --project ctfoj-demo --source build
  scripts/deploy.sh --custom --yes --lang en --register closed
  make deploy
  make deploy-custom
EXAMPLES
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --custom | -i) CUSTOM=1; shift ;;
    --yes | -y) ASSUME_YES=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --skip-migrate) SKIP_MIGRATE=1; shift ;;
    --no-build) SOURCE=pull; shift ;;
    --help | -h) SHOW_HELP=1; shift ;;
    --lang) [[ $# -ge 2 ]] || die option_value "$1"; LANG_OPT="$2"; shift 2 ;;
    --source) [[ $# -ge 2 ]] || die option_value "$1"; SOURCE="$2"; shift 2 ;;
    --pull-timeout) [[ $# -ge 2 ]] || die option_value "$1"; PULL_TIMEOUT="$2"; shift 2 ;;
    --port) [[ $# -ge 2 ]] || die option_value "$1"; PORT="$2"; shift 2 ;;
    --project) [[ $# -ge 2 ]] || die option_value "$1"; PROJECT="$2"; shift 2 ;;
    --registry) [[ $# -ge 2 ]] || die option_value "$1"; REGISTRY="$2"; shift 2 ;;
    --tag) [[ $# -ge 2 ]] || die option_value "$1"; TAG="$2"; shift 2 ;;
    --register) [[ $# -ge 2 ]] || die option_value "$1"; REGISTER="$2"; shift 2 ;;
    --instance-host) [[ $# -ge 2 ]] || die option_value "$1"; INSTANCE_HOST="$2"; shift 2 ;;
    --instance-port-range) [[ $# -ge 2 ]] || die option_value "$1"; PORT_RANGE="$2"; shift 2 ;;
    --secrets) [[ $# -ge 2 ]] || die option_value "$1"; SECRETS="$2"; shift 2 ;;
    --admin) [[ $# -ge 2 ]] || die option_value "$1"; ADMIN="$2"; shift 2 ;;
    --env-file) [[ $# -ge 2 ]] || die option_value "$1"; ENV_FILE="$2"; shift 2 ;;
    *) die unknown_option "$1" ;;
  esac
done

case "$LANG_OPT" in
  '') LANG_CODE="$(detect_lang)" ;;
  zh*) LANG_CODE=zh ;;
  en*) LANG_CODE=en ;;
  *) die bad_lang "$LANG_OPT" ;;
esac
export LANG_CODE

if (( SHOW_HELP )); then
  usage
  exit 0
fi

# ------------------------------------------------------------------ helpers

env_raw() {
  local line
  line="$(grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -n1 || true)"
  printf '%s' "${line#*=}"
}

env_or() { # env_or KEY FALLBACK
  local value
  value="$(env_raw "$1")"
  printf '%s' "${value:-$2}"
}

resolve() { # resolve FLAG_VALUE ENV_KEY BUILT_IN_DEFAULT
  local given="$1" key="$2" def="$3" stored
  if [[ -n "$given" ]]; then
    printf '%s' "$given"
    return 0
  fi
  stored="$(env_raw "$key")"
  printf '%s' "${stored:-$def}"
}

sed_escape() { printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'; }

set_env() {
  local key="$1" value="$2"
  [[ -n "$value" ]] || die no_default "$key"
  case "$key" in
    *SECRET* | *PASSWORD*) printf '    + %s=***\n' "$key" ;;
    *) printf '    + %s=%s\n' "$key" "$value" ;;
  esac
  (( DRY_RUN )) && return 0
  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    [[ "$(env_raw "$key")" == "$value" ]] && return 0
    sed -i.bak "s|^${key}=.*|${key}=$(sed_escape "$value")|" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
  chmod 600 "$ENV_FILE"
}

# Expose the env file to child processes (scripts/migrate.sh runs a bare
# `docker compose`, which would otherwise read .env and target another project).
# Lines are exported one by one so the file is never evaluated as shell code.
load_env() {
  local line key
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == *=* && "$line" != '#'* ]] || continue
    key="${line%%=*}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    export "$line"
  done <"$ENV_FILE"
}

compose() {
  printf '    + docker compose --env-file %s %s\n' "$ENV_FILE" "$*"
  (( DRY_RUN )) && return 0
  docker compose --env-file "$ENV_FILE" "$@"
}

# compose_timed LIMIT ARGS... -> 0 ok, 1 failed, 2 cut off at LIMIT seconds.
# A registry that accepts the connection and then stalls on the blobs looks
# exactly like a slow pull, so a deadline is what makes the fallback reachable.
compose_timed() {
  local limit="$1"; shift
  printf '    + docker compose --env-file %s %s\n' "$ENV_FILE" "$*"
  (( DRY_RUN )) && return 0
  if (( limit <= 0 )) || ! command -v timeout >/dev/null 2>&1; then
    (( limit > 0 )) && warn pull_timeout_missing
    docker compose --env-file "$ENV_FILE" "$@" && return 0 || return 1
  fi
  local rc=0
  timeout --kill-after=10s "${limit}s" docker compose --env-file "$ENV_FILE" "$@" || rc=$?
  case "$rc" in
    0) return 0 ;;
    124 | 137 | 143) return 2 ;;
    *) return 1 ;;
  esac
}

run() {
  printf '    + %s\n' "$*"
  (( DRY_RUN )) && return 0
  "$@"
}

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
  fi
}

has_default() {
  grep -qE "^$1=(change_me_in_production|replace_with_a_long_random_string)$" "$ENV_FILE" 2>/dev/null
}

valid_port() { [[ "$1" =~ ^[0-9]{1,5}$ ]] && ((10#$1 >= 1 && 10#$1 <= 65535)); }
valid_project() { [[ "$1" =~ ^[a-z0-9][a-z0-9_-]{1,63}$ ]]; }
valid_registry() { [[ "$1" == */* && "$1" != */ ]]; }
valid_tag() { [[ "$1" =~ ^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$ ]]; }
valid_timeout() { [[ "$1" =~ ^[0-9]{1,6}$ ]]; }
valid_host() { [[ -n "$1" && "$1" != *[[:space:]]* ]]; }
valid_range() {
  [[ "$1" =~ ^([0-9]{1,5})-([0-9]{1,5})$ ]] &&
    ((10#${BASH_REMATCH[1]} >= 1 && 10#${BASH_REMATCH[2]} <= 65535 &&
      10#${BASH_REMATCH[1]} < 10#${BASH_REMATCH[2]}))
}
# Mirrors usernameRe in backend/internal/pkg/crypto/crypto.go.
valid_username() { [[ "$1" =~ ^[A-Za-z0-9_]{3,32}$ ]]; }

port_busy() {
  local port="$1" wanted="$2" ids id project
  ids=$(docker ps -q --filter "publish=${port}" 2>/dev/null) || return 1
  for id in $ids; do
    project=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$id" 2>/dev/null)
    [[ "$project" == "$wanted" ]] || return 0
  done
  return 1
}

interactive() { [[ -t 0 ]] && (( ASSUME_YES == 0 )); }

ask_validated() { # ask_validated CHECKER QUESTION_KEY DEFAULT
  local checker="$1" key="$2" def="$3"
  while :; do
    ask "$key" "$def"
    "$checker" "$answer" && return 0
    interactive || die invalid_value "$answer"
    warn invalid_value "$answer"
  done
}

# ---------------------------------------------------------------- preflight

command -v docker >/dev/null 2>&1 || die docker_missing
docker compose version >/dev/null 2>&1 || die compose_missing

if [[ ! -f "$ENV_FILE" ]]; then
  say env_creating "$ENV_FILE"
  if (( DRY_RUN )); then
    printf '    + cp .env.example %s && chmod 600 %s\n' "$ENV_FILE" "$ENV_FILE"
  else
    cp .env.example "$ENV_FILE"
    chmod 600 "$ENV_FILE"
  fi
fi

if (( CUSTOM )) && [[ ! -t 0 ]] && (( ASSUME_YES == 0 )); then
  die wizard_no_tty
fi

(( DRY_RUN )) && say dry_run_notice

# ------------------------------------------------------------------ values
# Precedence: flag > wizard answer > env file > built-in default.

SOURCE="${SOURCE:-auto}"
PULL_TIMEOUT="${PULL_TIMEOUT:-$DEFAULT_PULL_TIMEOUT}"
PORT="$(resolve "$PORT" PUBLIC_HTTP_PORT "$DEFAULT_PORT")"
PROJECT="$(resolve "$PROJECT" COMPOSE_PROJECT_NAME "$DEFAULT_PROJECT")"
REGISTRY="$(resolve "$REGISTRY" CTFOJ_IMAGE_PREFIX "$DEFAULT_REGISTRY")"
TAG="$(resolve "$TAG" CTFOJ_IMAGE_TAG "$DEFAULT_TAG")"
REGISTER="$(resolve "$REGISTER" BACKEND_REGISTER_OPEN true)"
INSTANCE_HOST="$(resolve "$INSTANCE_HOST" BACKEND_INSTANCE_PUBLIC_HOST "$DEFAULT_INSTANCE_HOST")"
PORT_MIN="$(resolve '' BACKEND_INSTANCE_PORT_MIN "$DEFAULT_PORT_MIN")"
PORT_MAX="$(resolve '' BACKEND_INSTANCE_PORT_MAX "$DEFAULT_PORT_MAX")"
[[ -n "$PORT_RANGE" ]] || PORT_RANGE="${PORT_MIN}-${PORT_MAX}"
SECRETS="${SECRETS:-auto}"
[[ "$REGISTER" == false || "$REGISTER" == closed ]] && REGISTER=closed || REGISTER=open
# What this run would have used without the wizard: warnings only fire on a change.
PORT_ORIGINAL="$PORT"
PROJECT_ORIGINAL="$PROJECT"

if (( CUSTOM )); then
  say wizard_head
  printf '%s\n' "$(t wizard_note)"

  printf '\n%s\n' "$(t group_one)"
  ask_validated valid_port ask_port "$PORT"
  PORT="$answer"
  ask_validated valid_project ask_project "$PROJECT"
  PROJECT="$answer"
  if [[ "$PROJECT" != "$PROJECT_ORIGINAL" ]]; then
    warn project_warning "$PROJECT"
  fi
  if [[ "$PORT" != "$PORT_ORIGINAL" ]] && port_busy "$PORT" "$PROJECT"; then
    warn port_busy "$PORT"
  fi
  printf '%s\n' "$(t source_help)"
  ask_options ask_source "$SOURCE" 'auto pull build'
  SOURCE="$answer"

  printf '\n%s\n' "$(t group_two)"
  if [[ "$SOURCE" != build ]]; then
    ask_validated valid_registry ask_registry "$REGISTRY"
    REGISTRY="$answer"
    ask_validated valid_tag ask_tag "$TAG"
    TAG="$answer"
  fi
  ask_options ask_register "$REGISTER" 'open closed'
  REGISTER="$answer"
  ask_validated valid_host ask_instance_host "$INSTANCE_HOST"
  INSTANCE_HOST="$answer"
  ask_validated valid_range ask_instance_ports "$PORT_RANGE"
  PORT_RANGE="$answer"

  printf '\n%s\n' "$(t group_three)"
  printf '%s\n' "$(t secrets_help)"
  ask_options ask_secrets "$SECRETS" 'auto manual'
  SECRETS="$answer"

  printf '\n%s\n' "$(t group_four)"
  printf '%s\n' "$(t admin_help)"
  if [[ -n "$ADMIN" ]]; then ADMIN_NOW=yes; else ADMIN_NOW=no; fi
  ask_yes_no ask_admin_now "$ADMIN_NOW"
  ADMIN_NOW="$answer"
  if [[ "$ADMIN_NOW" == yes ]]; then
    ask_validated valid_username ask_admin "${ADMIN:-admin}"
    ADMIN="$answer"
  fi
fi

case "$SOURCE" in auto | pull | build) ;; *) die invalid_value "$SOURCE" ;; esac
case "$SECRETS" in auto | manual) ;; *) die invalid_value "$SECRETS" ;; esac
case "$REGISTER" in open | closed) ;; *) die invalid_value "$REGISTER" ;; esac
valid_port "$PORT" || die invalid_value "$PORT"
valid_project "$PROJECT" || die invalid_value "$PROJECT"
valid_registry "$REGISTRY" || die invalid_value "$REGISTRY"
valid_tag "$TAG" || die invalid_value "$TAG"
valid_timeout "$PULL_TIMEOUT" || die invalid_value "$PULL_TIMEOUT"
valid_range "$PORT_RANGE" || die invalid_value "$PORT_RANGE"
if [[ "$ADMIN_NOW" == yes || -n "$ADMIN" ]]; then
  valid_username "$ADMIN" || die invalid_value "$ADMIN"
fi
PORT_MIN="${PORT_RANGE%-*}"
PORT_MAX="${PORT_RANGE#*-}"
[[ "$REGISTER" == open ]] && REGISTER_VALUE=true || REGISTER_VALUE=false

# A copied env file still carries the shipped project name, so every compose call
# below — including a future `down -v` against it — would act on the real ctfoj
# deployment while reading a different set of credentials.
if [[ "$ENV_FILE" != .env && "$PROJECT" == "$DEFAULT_PROJECT" ]]; then
  warn env_file_default_project "$ENV_FILE" "$PROJECT"
fi

# --------------------------------------------------------------- env values
# Whatever this run acts on gets recorded, in both modes: an env file that
# disagrees with the running stack leaves every follow-up compose command —
# including the admin SQL printed at the end — pointed at the previous values.
# set_env is a no-op when the file already holds the value, so a plain
# `make deploy` against a stock .env still rewrites nothing.

say env_applying "$ENV_FILE"
set_env PUBLIC_HTTP_PORT "$PORT"
set_env COMPOSE_PROJECT_NAME "$PROJECT"
set_env CTFOJ_IMAGE_PREFIX "$REGISTRY"
set_env CTFOJ_IMAGE_TAG "$TAG"
set_env BACKEND_REGISTER_OPEN "$REGISTER_VALUE"
set_env BACKEND_INSTANCE_PUBLIC_HOST "$INSTANCE_HOST"
set_env BACKEND_INSTANCE_PORT_MIN "$PORT_MIN"
set_env BACKEND_INSTANCE_PORT_MAX "$PORT_MAX"

# ------------------------------------------------------------------ secrets

if [[ "$SECRETS" == manual ]]; then
  say secrets_manual
  leftover=()
  for key in BACKEND_JWT_SECRET POSTGRES_PASSWORD POSTGRES_ROOT_PASSWORD; do
    has_default "$key" && leftover+=("$key")
  done
  (( ${#leftover[@]} )) && warn secrets_placeholder "${leftover[*]}" "$ENV_FILE"
else
  if has_default BACKEND_JWT_SECRET; then
    say secret_generating BACKEND_JWT_SECRET
    set_env BACKEND_JWT_SECRET "$(gen_secret)"
  fi
  if has_default POSTGRES_PASSWORD || has_default POSTGRES_ROOT_PASSWORD; then
    volume="${PROJECT}_pg-data"
    if docker volume ls --format '{{.Name}}' 2>/dev/null | grep -qx "$volume"; then
      warn secret_db_in_use "$volume"
    else
      say secret_generating POSTGRES_PASSWORD
      set_env POSTGRES_PASSWORD "$(gen_secret)"
      set_env POSTGRES_ROOT_PASSWORD "$(gen_secret)"
    fi
  fi
fi

# ----------------------------------------------------------------- exports
# Only now, after every set_env: the shell environment outranks the env file for
# compose interpolation, so exporting earlier would publish the placeholder
# secret this run just replaced — postgres would initialise against that and the
# recorded password would only start working at the next deploy.

export COMPOSE_PROJECT_NAME="$PROJECT"
if [[ "$ENV_FILE" != .env ]]; then
  load_env
  export COMPOSE_PROJECT_NAME="$PROJECT"
fi
# A flag that was not persisted still decides which images this run pulls.
export CTFOJ_IMAGE_PREFIX="$REGISTRY"
export CTFOJ_IMAGE_TAG="$TAG"
export PUBLIC_HTTP_PORT="$PORT"
export BACKEND_REGISTER_OPEN="$REGISTER_VALUE"
export BACKEND_INSTANCE_PUBLIC_HOST="$INSTANCE_HOST"
export BACKEND_INSTANCE_PORT_MIN="$PORT_MIN"
export BACKEND_INSTANCE_PORT_MAX="$PORT_MAX"

# ---------------------------------------------------------------- run stack

(( DRY_RUN )) || compose config -q

if [[ "$SOURCE" == build ]]; then
  say source_build "$REGISTRY"
  UP_FLAGS=(--build)
else
  if (( PULL_TIMEOUT > 0 )); then
    say source_pull "$REGISTRY" "$TAG" "$(t pull_deadline "$PULL_TIMEOUT")"
  else
    say source_pull "$REGISTRY" "$TAG" "$(t pull_deadline_none)"
  fi
  if compose_timed "$PULL_TIMEOUT" pull --quiet backend worker frontend; then
    say source_pull_ok
    UP_FLAGS=(--no-build)
  else
    pull_rc=$?
    if (( pull_rc == 2 )); then
      warn source_pull_timeout "$PULL_TIMEOUT"
    fi
    if [[ "$SOURCE" == pull ]]; then
      if (( pull_rc == 2 )); then
        die source_pull_abort_timeout "$PULL_TIMEOUT"
      else
        die source_pull_failed "$REGISTRY" "$TAG"
      fi
    fi
    warn source_pull_fallback
    UP_FLAGS=(--build)
  fi
fi

say infra_start
compose up -d postgres redis
if (( SKIP_MIGRATE )); then
  say migrate_skipped
else
  say migrate_running
  run ./scripts/migrate.sh
fi
say stack_start
compose up -d "${UP_FLAGS[@]}"

URL="http://127.0.0.1:${PORT}"
health() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "${URL}/api/v1/health" >/dev/null 2>&1
  else
    wget -qO- "${URL}/api/v1/health" >/dev/null 2>&1
  fi
}

if (( DRY_RUN )); then
  say health_skipped "${URL}/api/v1/health"
else
  say health_waiting "${URL}/api/v1/health"
  ready=0
  for _ in $(seq 1 90); do
    if health; then
      ready=1
      break
    fi
    sleep 2
  done
  (( ready )) || die health_failed "${URL}/api/v1/health"
fi

# ------------------------------------------------------------------ summary

DB_USER="$(env_or POSTGRES_USER ctfoj)"
DB_NAME="$(env_or POSTGRES_DB ctfoj)"
if (( DRY_RUN )); then
  STATUS="$(t summary_dry)"
else
  STATUS="$(t summary_done)"
fi

cat <<EOF

$(t summary_head)
  $(t summary_url) ${URL}
  $(t summary_source) $(t "source_mode_${SOURCE}")
  $(t summary_images) ${REGISTRY}/{backend,frontend}:${TAG}
  $(t summary_project) ${PROJECT}
  $(t summary_env) ${ENV_FILE}
  $(t summary_register) $(t "register_${REGISTER}")
  $(t summary_instance) ${INSTANCE_HOST} ${PORT_MIN}-${PORT_MAX}
  $(t summary_status) ${STATUS}
EOF

if (( CUSTOM == 0 )) || [[ "$ADMIN_NOW" == yes ]]; then
  cat <<EOF

$(t admin_head)
  $(t admin_step1)
  docker compose -p ${PROJECT} --env-file ${ENV_FILE} exec -T postgres psql -U ${DB_USER} -d ${DB_NAME} -c "UPDATE users SET role='admin' WHERE username='${ADMIN:-YOUR_NAME}';"
  $(t admin_step2)
EOF
else
  printf '\n%s\n' "$(t admin_skipped)"
fi

printf '\n%s\n' "$(t useful_head)"
printf '  docker compose -p %s --env-file %s logs -f --tail=200\n' "$PROJECT" "$ENV_FILE"
printf '  make backup\n'

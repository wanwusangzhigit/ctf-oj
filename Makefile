.PHONY: help deploy deploy-custom up down backend-dev frontend-dev build build-backend build-frontend up-prod migrate migrate-all logs psql redis-cli clean fmt vet test backup restore

help:
	@echo "Available targets:"
	@echo "  up            Start dependency containers (postgres, redis)"
	@echo "  down          Stop all containers"
	@echo "  deploy        One-command deploy (secrets + image pull with local build fallback + migrations + health check)"
	@echo "  deploy-custom Same deploy, interactive wizard (every question has a flag: ./scripts/deploy.sh --help)"
	@echo "  up-prod       Build and start full stack (backend + frontend + caddy)"
	@echo "  backend-dev   Run backend on the host (go run, restart manually)"
	@echo "  frontend-dev  Run frontend dev server (vite)"
	@echo "  build         Build backend and frontend docker images"
	@echo "  migrate       Apply pending database migrations (tracked)"
	@echo "  logs          Tail docker compose logs"
	@echo "  psql          Connect to postgres via psql"
	@echo "  redis-cli     Connect to redis via redis-cli"
	@echo "  clean         Remove all containers and volumes (DESTRUCTIVE)"
	@echo "  fmt           Format Go code"
	@echo "  vet           Run go vet"
	@echo "  test          Run Go tests"

deploy:
	@./scripts/deploy.sh $(ARGS)

deploy-custom:
	@./scripts/deploy.sh --custom $(ARGS)

up:
	docker compose up -d postgres redis

down:
	docker compose down

up-prod:
	docker compose up -d --build

backend-dev:
	cd backend && go run ./cmd/server

frontend-dev:
	cd frontend && npm run dev

build: build-backend build-frontend

build-backend:
	docker compose build backend

build-frontend:
	docker compose build frontend

migrate:
	@./scripts/migrate.sh

## migrate-all is kept as an alias; migrations are tracked in schema_migrations.
migrate-all: migrate

logs:
	docker compose logs -f --tail=200

psql:
	PGPASSWORD=$$(grep POSTGRES_PASSWORD .env | cut -d= -f2) psql -h localhost -U $$(grep POSTGRES_USER .env | cut -d= -f2) -d $$(grep POSTGRES_DB .env | cut -d= -f2)

redis-cli:
	redis-cli -h localhost -p 6379

clean:
	docker compose down -v --remove-orphans

fmt:
	cd backend && go fmt ./...

vet:
	cd backend && go vet ./...

test:
	cd backend && go test ./...

## backup creates a compressed binary dump of the postgres database under ./backups/.
backup:
	@mkdir -p backups
	@TS=$$(date -u +%Y%m%dT%H%M%SZ); \
	OUT="backups/ctfoj-$$TS.dump"; \
	docker compose exec -T postgres pg_dump -U "$${POSTGRES_USER:-ctfoj}" -Fc "$${POSTGRES_DB:-ctfoj}" > $$OUT; \
	echo "Wrote $$OUT  ($$(du -h $$OUT | cut -f1))"

## restore loads a pg_dump -Fc backup produced by `make backup`.
## Usage: make restore FILE=backups/ctfoj-20240101T120000Z.dump
restore:
	@if [ -z "$(FILE)" ]; then echo "Usage: make restore FILE=backups/ctfoj-XXXX.dump"; exit 1; fi
	@if [ ! -f "$(FILE)" ]; then echo "File not found: $(FILE)"; exit 1; fi
	@echo "Restoring $(FILE) — this OVERWRITES the current database."
	@read -p "Type the database name to confirm ($${POSTGRES_DB:-ctfoj}): " DB; \
	if [ "$$DB" != "$${POSTGRES_DB:-ctfoj}" ]; then echo "Aborted."; exit 1; fi
	docker compose exec -T postgres pg_restore -U "$${POSTGRES_USER:-ctfoj}" -d "$${POSTGRES_DB:-ctfoj}" --clean --if-exists < $(FILE)
	@echo "Restore complete."

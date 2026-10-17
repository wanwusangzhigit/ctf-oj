.PHONY: help up down backend-dev frontend-dev build build-backend build-frontend up-prod migrate logs psql redis-cli clean fmt vet test

help:
	@echo "Available targets:"
	@echo "  up            Start dependency containers (postgres, redis)"
	@echo "  down          Stop all containers"
	@echo "  up-prod       Build and start full stack (backend + frontend + caddy)"
	@echo "  backend-dev   Run backend with hot reload (air)"
	@echo "  frontend-dev  Run frontend dev server (vite)"
	@echo "  build         Build backend and frontend docker images"
	@echo "  migrate       Apply database migrations"
	@echo "  logs          Tail docker compose logs"
	@echo "  psql          Connect to postgres via psql"
	@echo "  redis-cli     Connect to redis via redis-cli"
	@echo "  clean         Remove all containers and volumes (DESTRUCTIVE)"
	@echo "  fmt           Format Go code"
	@echo "  vet           Run go vet"
	@echo "  test          Run Go tests"

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
	@docker compose exec -T postgres sh -c 'psql -U "$${POSTGRES_USER}" -d "$${POSTGRES_DB}" -f -' < backend/migrations/000001_init.up.sql
	@echo "Migration applied."

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

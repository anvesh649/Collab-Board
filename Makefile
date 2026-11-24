# CollabBoard developer commands. Run `make` (or `make help`) to list them.
#
# Notes for editing:
#   - Recipe lines must start with a TAB, not spaces.
#   - Each recipe line runs in its own shell, so `cd` must be on the same line as the command.
#   - Write `$$` for a literal `$` (a single `$` is a Make variable).
#   - Add `## description` after a target to show it in `make help`; `##@ Name` starts a section.

.DEFAULT_GOAL := help

# Every API command runs from apps/api. Bun installs and runs scripts; the server runs on Node.
API := cd apps/api &&
PRISMA := $(API) bunx prisma

.PHONY: help install env up down logs psql db-reset run run-json build start migrate \
        makemigrations generate studio typecheck test fmt lint makemigrations-check ci

##@ Help

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make <target>\n"} \
	/^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 } \
	/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)

##@ Setup

install: ## Install the locked dependencies and generate the Prisma client
	bun install --frozen-lockfile
	$(PRISMA) generate

env: ## Create .env from .env.example (never overwrites an existing .env)
	cp -n .env.example .env

##@ Database (Docker)

up: ## Start PostgreSQL in the background
	docker compose up -d db

down: ## Stop and remove the database container (data is kept in the volume)
	docker compose down

logs: ## Follow the PostgreSQL logs
	docker compose logs -f db

psql: ## Open a psql shell inside the database container
	docker compose exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

db-reset: ## DELETE all database data and start a fresh, empty database (asks first)
	@read -p "This deletes all local database data. Continue? [y/N] " ans && [ "$$ans" = y ]
	docker compose down -v
	docker compose up -d db

##@ API

run: ## Start the API in watch mode (log format from .env)
	$(API) bun run dev

run-json: ## Start the API with production-style JSON logs, pretty-printed by jq
	$(API) LOG_FORMAT=json bun run dev 2>&1 | jq -R 'fromjson? // .'

build: ## Compile the API to apps/api/dist
	$(API) bun run build

start: build ## Run the compiled API on Node, as production does
	$(API) node dist/main.js

migrate: ## Apply pending migrations (never resets the database)
	$(PRISMA) migrate deploy

makemigrations: ## Create a migration from schema changes without applying it: make makemigrations name=add_boards
	$(PRISMA) migrate dev --create-only --name $(or $(name),change)

generate: ## Regenerate the Prisma client after editing schema.prisma
	$(PRISMA) generate

studio: ## Browse the database in Prisma Studio
	$(PRISMA) studio

##@ Quality

typecheck: ## Type-check without building
	$(API) bun run typecheck

test: ## Run the test suite (starts a throwaway PostgreSQL container)
	$(API) bun run test

fmt: ## Auto-fix lint issues and format the code
	$(API) bun run lint --fix
	bunx prettier --write .

lint: ## Check lint and formatting without changing files (what CI runs)
	$(API) bun run lint
	bunx prettier --check .

makemigrations-check: ## Fail if schema.prisma changed without a migration (needs SHADOW_DATABASE_URL)
	$(PRISMA) migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code

ci: lint typecheck makemigrations-check test ## Run every check CI runs, before you push

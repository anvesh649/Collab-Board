# CollabBoard developer commands. Run `make` (or `make help`) to list them.
#
# Notes for editing:
#   - Recipe lines must start with a TAB, not spaces.
#   - Each recipe line runs in its own shell, so `cd backend` must be on the same line as the command.
#   - Write `$$` for a literal `$` (a single `$` is a Make variable).
#   - Add `## description` after a target to show it in `make help`; `##@ Name` starts a section.

.DEFAULT_GOAL := help

# Every Django command runs from backend/ through uv's virtualenv.
MANAGE := cd backend && uv run python manage.py
UV := cd backend && uv run

.PHONY: help install env up down logs psql db-reset run run-json migrate makemigrations \
        superuser shell check fmt lint makemigrations-check ci

##@ Help

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make <target>\n"} \
	/^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 } \
	/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)

##@ Setup

install: ## Create backend/.venv and install the locked dependencies
	cd backend && uv sync

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

##@ Django

run: ## Start the dev server (log format from .env)
	$(MANAGE) runserver

run-json: ## Start the dev server with production-style JSON logs, pretty-printed by jq
	cd backend && DJANGO_LOG_FORMAT=json uv run python manage.py runserver 2>&1 | jq -R 'fromjson? // .'

migrate: ## Apply database migrations
	$(MANAGE) migrate

makemigrations: ## Create migrations after model changes
	$(MANAGE) makemigrations

superuser: ## Create an admin user (prompts for email and password)
	$(MANAGE) createsuperuser

shell: ## Open the Django shell
	$(MANAGE) shell

check: ## Run Django's system checks
	$(MANAGE) check

##@ Quality

fmt: ## Auto-fix lint issues and format the code
	$(UV) ruff check . --fix
	$(UV) ruff format .

lint: ## Check lint and formatting without changing files (what CI runs)
	$(UV) ruff check .
	$(UV) ruff format --check .

makemigrations-check: ## Fail if a model changed without a migration
	$(MANAGE) makemigrations --check --dry-run

ci: lint makemigrations-check check ## Run every check CI runs, before you push

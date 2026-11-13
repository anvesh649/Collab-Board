# CollabBoard

A real-time collaborative whiteboard. The backend is Django on PostgreSQL.

```
collabboard/
├── backend/             Django project (uv-managed)
│   ├── config/          settings, URLs, ASGI/WSGI entry points
│   └── accounts/        custom user model (email login, UUIDv7 primary key)
├── docker-compose.yaml  local PostgreSQL
├── .env.example         every config variable, with placeholder values
└── README.md
```

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (installs and manages Python 3.14 for you)
- Docker Desktop (for PostgreSQL)

## Getting started

```bash
cp .env.example .env              # then edit .env: set a password and a generated secret key
docker compose up -d db           # start PostgreSQL; wait until `docker compose ps` shows healthy
cd backend
uv sync                           # create .venv and install locked dependencies
uv run python manage.py migrate
uv run python manage.py createsuperuser
uv run python manage.py runserver
```

Admin: http://127.0.0.1:8000/admin/ (log in with your email).

## Configuration

All configuration comes from environment variables. Nothing secret is committed; `.env` is git-ignored.

| Variable | Required | Default | Used by | Purpose |
|---|---|---|---|---|
| `DJANGO_SECRET_KEY` | yes | none, startup fails | Django | Signing key for sessions, CSRF and password reset tokens |
| `DJANGO_DEBUG` | no | `false` | Django | Debug pages and auto-reload. Never `true` in production |
| `DATABASE_URL` | yes | none, startup fails | Django | Database connection, e.g. `postgres://user:pass@host:5432/db` |
| `POSTGRES_DB` | yes, for Compose | none | docker-compose | Database created on first start |
| `POSTGRES_USER` | yes, for Compose | none | docker-compose | Database user created on first start |
| `POSTGRES_PASSWORD` | yes, for Compose | none | docker-compose | Password for that user |

Required variables have no fallback on purpose: a missing secret or database URL stops the app at startup instead of running with a wrong value. `DEBUG` defaults to off, so forgetting to set it fails safe.

### Precedence

When the same variable is set in more than one place, the first match wins:

1. **Real environment variables**: exported in your shell, set inline (`DJANGO_DEBUG=false uv run ...`), or set by the platform (Docker, Kubernetes, CI)
2. **`.env`** in the repository root (local development only)
3. **Defaults in `settings.py`**, only for optional variables such as `DJANGO_DEBUG`

This works because `environ.Env.read_env()` only fills in variables that are not already set; it never overwrites them. In production there is no `.env` file, and the platform supplies everything as real environment variables.

To check it yourself, with `DJANGO_DEBUG=true` in `.env`:

```bash
cd backend
uv run python manage.py shell -c "from django.conf import settings; print(settings.DEBUG)"
# True   (from .env)
DJANGO_DEBUG=false uv run python manage.py shell -c "from django.conf import settings; print(settings.DEBUG)"
# False  (the real environment variable wins)
```

Note: `docker compose` also reads `.env` from this folder to fill `${POSTGRES_*}` in `docker-compose.yaml`, with the same rule that shell variables win.

## Common commands

| Task | Command |
|---|---|
| Start / stop the database | `docker compose up -d db` / `docker compose stop` |
| Database shell | `docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'` |
| Wipe the database (deletes all data) | `docker compose down -v` |
| Create migrations after model changes | `cd backend && uv run python manage.py makemigrations` |
| Apply migrations | `cd backend && uv run python manage.py migrate` |
| Check for config problems | `cd backend && uv run python manage.py check` |

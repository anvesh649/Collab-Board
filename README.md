# CollabBoard

A real-time collaborative whiteboard. The API is NestJS with Prisma on PostgreSQL, in a Bun
workspace. Bun installs packages and runs scripts; the server itself runs on Node.js LTS.

The first version was written in Django. It is kept in git history under the tag `django-final`.

```
collabboard/
├── apps/
│   └── api/                    NestJS API
│       ├── prisma/             schema.prisma and SQL migrations
│       ├── src/
│       │   ├── accounts/       users: email login, UUIDv7 ids, argon2 password hashes
│       │   ├── config/         environment schema, validated at startup
│       │   ├── database/       the Prisma client, connected on start, closed on shutdown
│       │   ├── http/           request IDs and the allowed-hosts check
│       │   └── logging/        pino: JSON or console, one canonical line per request
│       └── test/               Vitest, against a real PostgreSQL container
├── docker/postgres/init.sql    creates the shadow database on first start
├── docker-compose.yaml         local PostgreSQL
├── Makefile                    developer commands (`make` lists them)
├── .env.example                every config variable, with placeholder values
└── package.json                Bun workspace root
```

## Prerequisites

- [Bun](https://bun.sh) for installing packages and running scripts
- Node.js 24 LTS (see `.node-version`) to run the server, as production does
- Docker Desktop, for PostgreSQL and for the tests

## Getting started

```bash
make env          # create .env from .env.example, then set a password in it
make install      # bun install --frozen-lockfile, then generate the Prisma client
make up           # start PostgreSQL; wait until `docker compose ps` shows healthy
make migrate      # apply the migrations
make run          # the API on http://localhost:3000, restarting on changes
```

## Configuration

All configuration comes from environment variables, validated once at startup by a `zod`
schema in `apps/api/src/config/env.ts`. A missing or malformed value stops the process with
a list of every problem. Nothing secret is committed; `.env` is git-ignored.

| Variable              | Required                        | Default             | Purpose                                                                                                                                                                                                                                   |
| --------------------- | ------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`            | no                              | `production`        | `development`, `test` or `production`. Unset means production, so a forgotten setting fails safe                                                                                                                                          |
| `PORT`                | no                              | `3000`              | Port the API listens on                                                                                                                                                                                                                   |
| `DATABASE_URL`        | yes                             | none, startup fails | PostgreSQL connection, e.g. `postgres://user:pass@host:5432/db`                                                                                                                                                                           |
| `SHADOW_DATABASE_URL` | only for the migrations check   | none                | An empty scratch database that `make makemigrations-check` replays the migrations into                                                                                                                                                    |
| `ALLOWED_HOSTS`       | yes, when `NODE_ENV=production` | empty               | Comma-separated hostnames the API answers to, no scheme or port (`shop.com,.shop.com`). Any other `Host` header gets 400, which blocks Host header poisoning. Outside production, `localhost`, `127.0.0.1` and `[::1]` are always allowed |
| `LOG_FORMAT`          | no                              | `json`              | `json` (one JSON object per line, for production and log tools) or `console` (readable text, for local development)                                                                                                                       |
| `LOG_LEVEL`           | no                              | `info`              | Minimum level logged: `trace`, `debug`, `info`, `warn`, `error`, `fatal`                                                                                                                                                                  |
| `POSTGRES_DB`         | yes, for Compose                | none                | Database created when the volume is first created                                                                                                                                                                                         |
| `POSTGRES_USER`       | yes, for Compose                | none                | Database user created on first start                                                                                                                                                                                                      |
| `POSTGRES_PASSWORD`   | yes, for Compose                | none                | Password for that user                                                                                                                                                                                                                    |

### Precedence

When the same variable is set in more than one place, the first match wins:

1. **Real environment variables**: exported in your shell, set inline (`LOG_FORMAT=json make run`), or set by the platform (Docker, Kubernetes, CI)
2. **`.env`** in the repository root (local development only)
3. **Defaults in `env.ts`**, only for optional variables such as `LOG_FORMAT`

This works because `@nestjs/config` (and `process.loadEnvFile` in `prisma.config.ts`) only
fill in variables that are not already set; they never overwrite them. In production there
is no `.env` file, and the platform supplies everything as real environment variables.
`docker compose` reads the same `.env` to fill `${POSTGRES_*}`, with the same rule.

## Database

- The schema is `apps/api/prisma/schema.prisma`; migrations are plain SQL in `prisma/migrations/`.
  Review the SQL of every migration before committing it, and never edit one that has been applied elsewhere.
- Rules the Prisma schema cannot express (CHECK constraints) are added by hand to the migration SQL.
  Prisma ignores them when comparing, so they are not dropped by later migrations.
- `make migrate` runs `prisma migrate deploy`, which only applies pending migrations.
  `prisma migrate dev` can reset a database, so it is used only to create migrations (`make makemigrations name=...`).
- User emails are stored trimmed and lowercased, and a CHECK constraint rejects anything else,
  so `A@x.com` and `a@x.com` can never be two accounts. User IDs are UUIDv7 from PostgreSQL 18's `uuidv7()`.

## Logging

All logs go to stdout as structured lines; the platform (Docker, later Loki) collects them.
Nothing writes log files. The setup is in `apps/api/src/logging/`.

- **Request IDs.** Each request reuses a valid incoming `X-Request-ID` header (letters, digits and
  `-`, at most 128 characters) or gets a new UUID. It is returned in the `X-Request-ID` response
  header, so quote it in bug reports, and it is on every line logged during that request,
  including lines from services, through `AsyncLocalStorage`.
- **Canonical line.** Exactly one `http_request` line per request with `method`, `route` (the
  pattern such as `/boards/:id`, never the raw path or query string), `status`, `duration_ms` and
  `user_id`, including for 404s (`route: null`) and 500s.
- **Errors** are logged once, with their stack trace, by Nest's exception handler, under the same `request_id`.
- **Never log** passwords, tokens, cookies, request bodies or emails. Log IDs instead.

Writing a log line from a service:

```ts
constructor(private readonly log: PinoLogger) {}

this.log.info({ board_id: board.id }, "board_opened"); // fields first, then a fixed snake_case event name
```

## Common commands

Run these from the repository root. `make` on its own lists every target.

| Task                                                          | Command                                                   |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| First-time setup                                              | `make env install up migrate`                             |
| Start / stop the database                                     | `make up` / `make down`                                   |
| Database shell                                                | `make psql`                                               |
| Wipe the database (asks first, deletes all data)              | `make db-reset`                                           |
| API in watch mode                                             | `make run` (or `make run-json` for production-style logs) |
| Build and run the compiled API on Node                        | `make start`                                              |
| Create / apply migrations                                     | `make makemigrations name=...` / `make migrate`           |
| Tests (starts a throwaway PostgreSQL container)               | `make test`                                               |
| Format and auto-fix                                           | `make fmt`                                                |
| Everything CI checks (lint, types, missing migrations, tests) | `make ci`                                                 |

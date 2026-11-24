-- Runs once, when the database volume is first created (docker-entrypoint-initdb.d).
-- An empty scratch database that `prisma migrate diff --from-migrations` replays the
-- migrations into, so CI and `make makemigrations-check` can detect a missing migration.
CREATE DATABASE collabboard_shadow;

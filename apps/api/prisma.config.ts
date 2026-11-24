import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer reads .env by itself. Load the repo-root .env for local work;
// process.loadEnvFile never overwrites variables that are already set, so real
// environment variables (CI, production) still win.
for (const file of [".env", "../../.env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: env("DATABASE_URL"),
    // An empty scratch database that `prisma migrate diff --from-migrations` replays the
    // migrations into (make makemigrations-check). Optional: only that check needs it.
    ...(process.env.SHADOW_DATABASE_URL && { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }),
  },
});

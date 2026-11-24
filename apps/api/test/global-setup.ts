import { execFileSync } from "node:child_process";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

let container: StartedPostgreSqlContainer | undefined;

/** Real PostgreSQL (same major version as production), never a mock or SQLite. */
export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer("postgres:18").start();
  const url = container.getConnectionUri();
  execFileSync("bunx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });
  project.provide("databaseUrl", url);
}

export async function teardown(): Promise<void> {
  await container?.stop();
}

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

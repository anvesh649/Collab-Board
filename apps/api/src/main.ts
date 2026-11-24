import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import type { Env } from "./config/env";

async function bootstrap(): Promise<void> {
  // bufferLogs holds Nest's startup messages until pino is ready, so they come out
  // in the same format as everything else.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // Without this, onModuleDestroy (closing the database pool) never runs on SIGTERM.
  app.enableShutdownHooks();

  const config = app.get(ConfigService<Env, true>);
  await app.listen(config.get("PORT", { infer: true }));
}

bootstrap().catch((err: unknown) => {
  // Logging may not be up yet (for example, invalid configuration), so write to stderr.
  console.error(err);
  process.exit(1);
});

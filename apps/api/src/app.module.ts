import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AccountsModule } from "./accounts/accounts.module";
import { validateEnv } from "./config/env";
import { DatabaseModule } from "./database/database.module";
import { AllowedHostsMiddleware } from "./http/allowed-hosts.middleware";
import { LoggingModule } from "./logging/logging.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Local development only; production has no .env. Real environment variables always
      // win over these files, and the first file listed wins over the second.
      envFilePath: [".env", "../../.env"],
      validate: validateEnv,
    }),
    LoggingModule,
    DatabaseModule,
    AccountsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Express 5 path syntax: "{*splat}" matches every path including "/". A bare "*splat"
    // needs at least one segment, so it would skip the root.
    consumer.apply(AllowedHostsMiddleware).forRoutes("{*splat}");
  }
}

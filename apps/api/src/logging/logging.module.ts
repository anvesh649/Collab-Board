import type { IncomingMessage, ServerResponse } from "node:http";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import type { Options } from "pino-http";
import type { Env } from "../config/env";
import { requestIdFrom } from "../http/request-id";
import { type RequestWithPattern, RoutePatternInterceptor } from "./route-pattern.interceptor";

type LoggedRequest = IncomingMessage & RequestWithPattern & { user?: { id?: string } };

/** The fields of the one canonical line written when a request finishes. */
function canonicalLine(req: LoggedRequest, res: ServerResponse, responseTime: unknown) {
  return {
    method: req.method,
    // The route pattern groups requests by endpoint. Raw paths, query strings, headers and
    // bodies are left out on purpose: they carry tokens and personal data.
    route: req.routePattern ?? null,
    status: res.statusCode,
    duration_ms: responseTime,
    user_id: req.user?.id ?? null,
  };
}

/**
 * Structured logging, ported from the Django structlog setup:
 *  - JSON in production, readable text with LOG_FORMAT=console; level from LOG_LEVEL.
 *  - Every request gets a request ID (reused from X-Request-ID when valid), echoed in the
 *    response header and attached to every line logged during that request, including
 *    lines from services, through nestjs-pino's AsyncLocalStorage context.
 *  - Exactly one canonical "http_request" line per request, written when it finishes,
 *    with method, route pattern, status, duration and user, even for 404s and 500s.
 */
export function pinoHttpOptions(env: Pick<Env, "LOG_LEVEL" | "LOG_FORMAT">): Options {
  return {
    level: env.LOG_LEVEL,
    ...(env.LOG_FORMAT === "console" && {
      transport: {
        target: "pino-pretty",
        options: {
          singleLine: true,
          translateTime: "SYS:HH:MM:ss.l",
          ignore: "pid,hostname",
          messageKey: "event",
        },
      },
    }),
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    formatters: { level: (label) => ({ level: label }) },
    base: null, // drop pid and hostname: the platform already labels every line with them
    messageKey: "event",

    genReqId: (req: IncomingMessage, res: ServerResponse) => {
      const id = requestIdFrom(req.headers["x-request-id"]);
      res.setHeader("X-Request-ID", id);
      return id;
    },
    // The only field bound for the whole request; every line logged during it carries it.
    customProps: (req) => ({ request_id: req.id }),
    // pino-http would otherwise log the full request and response objects.
    serializers: { req: () => undefined, res: () => undefined },

    customSuccessMessage: () => "http_request",
    customErrorMessage: () => "http_request",
    customLogLevel: (_req, res, err) => {
      if (err !== undefined || res.statusCode >= 500) return "error";
      return res.statusCode >= 400 ? "warn" : "info";
    },
    customSuccessObject: (req, res, val: { responseTime?: unknown }) =>
      canonicalLine(req as LoggedRequest, res, val.responseTime),
    // For a 5xx, pino-http only knows the status, so its "error" is a made-up "failed with
    // status code 500". Nest's exception handler already logged the real error and stack
    // with the same request_id, so the canonical line stays the canonical line.
    customErrorObject: (req, res, _err, val: { responseTime?: unknown }) =>
      canonicalLine(req as LoggedRequest, res, val.responseTime),
  };
}

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: pinoHttpOptions({
          LOG_LEVEL: config.get("LOG_LEVEL", { infer: true }),
          LOG_FORMAT: config.get("LOG_FORMAT", { infer: true }),
        }),
      }),
    }),
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: RoutePatternInterceptor }],
})
export class LoggingModule {}

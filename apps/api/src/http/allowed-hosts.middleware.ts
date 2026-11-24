import { Injectable, type NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NextFunction, Request, Response } from "express";
import type { Env } from "../config/env";

/** "Example.com:3000" -> "example.com", "[::1]:3000" -> "[::1]". */
export function hostnameOf(hostHeader: string): string {
  const host = hostHeader.trim().toLowerCase();
  if (host.startsWith("[")) return host.slice(0, host.indexOf("]") + 1);
  return host.split(":")[0] ?? "";
}

export function isAllowedHost(hostname: string, allowed: readonly string[]): boolean {
  return allowed.some((pattern) =>
    pattern.startsWith(".")
      ? hostname === pattern.slice(1) || hostname.endsWith(pattern)
      : hostname === pattern,
  );
}

/**
 * The port of Django's ALLOWED_HOSTS. The Host header comes from the client, and anything
 * that builds absolute URLs from it (password-reset links, redirects) can be poisoned.
 * Requests for any other host get 400 before reaching a controller.
 */
@Injectable()
export class AllowedHostsMiddleware implements NestMiddleware {
  private readonly allowed: readonly string[];

  constructor(config: ConfigService<Env, true>) {
    this.allowed = config.get("ALLOWED_HOSTS", { infer: true });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const hostname = hostnameOf(req.headers.host ?? "");
    if (isAllowedHost(hostname, this.allowed)) {
      next();
      return;
    }
    req.log.warn({ host: hostname }, "disallowed_host");
    res.status(400).type("application/problem+json").json({
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      detail: "Invalid Host header.",
    });
  }
}

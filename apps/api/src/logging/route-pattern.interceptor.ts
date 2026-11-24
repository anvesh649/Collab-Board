import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import type { Observable } from "rxjs";

export type RequestWithPattern = Request & { routePattern?: string };

/**
 * Records which controller route handled the request, e.g. "/boards/:id", for the
 * canonical log line. It only runs when a controller matched, so unmatched URLs (404s)
 * and requests stopped by middleware log `route: null` rather than a middleware's path.
 */
@Injectable()
export class RoutePatternInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithPattern>();
    // Express types req.route as any. While a handler runs, it is that handler's route.
    const path = (req.route as { path?: unknown } | undefined)?.path;
    if (typeof path === "string") req.routePattern = `${req.baseUrl}${path}`;
    return next.handle();
  }
}

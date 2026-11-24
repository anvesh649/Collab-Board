import { randomUUID } from "node:crypto";

// Compiled once at import. Only short IDs of safe characters are trusted from a client,
// so nobody can bloat or forge log lines through the X-Request-ID header.
const REQUEST_ID_RE = /^[A-Za-z0-9-]{1,128}$/;

/**
 * Reuses a valid incoming X-Request-ID (set by a load balancer or proxy, so one ID
 * follows the request through every layer) or generates a new one.
 */
export function requestIdFrom(header: string | string[] | undefined): string {
  const raw = Array.isArray(header) ? header[0] : header;
  return raw !== undefined && REQUEST_ID_RE.test(raw) ? raw : randomUUID();
}

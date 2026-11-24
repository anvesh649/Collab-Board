import { z } from "zod";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Every setting the API reads, validated once at startup. A missing or malformed value
 * stops the process with a readable error instead of failing later on some request.
 *
 * Precedence (see README, "Configuration"): real environment variables, then `.env`,
 * then the defaults below. Only optional settings have defaults.
 */
export const envSchema = z
  .object({
    // Fails safe: unset means production behaviour (no pretty logs, no localhost hosts).
    NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
    // json for production and log tools; console for readable local output.
    LOG_FORMAT: z.enum(["json", "console"]).default("json"),
    // Comma-separated hostnames, no scheme or port. ".example.com" also allows subdomains.
    ALLOWED_HOSTS: z
      .string()
      .default("")
      .transform((raw) =>
        raw
          .split(",")
          .map((h) => h.trim().toLowerCase())
          .filter(Boolean),
      ),
  })
  .transform((env) => ({
    ...env,
    // Like Django with DEBUG on: local development always answers to localhost.
    ALLOWED_HOSTS:
      env.NODE_ENV === "production" ? env.ALLOWED_HOSTS : [...env.ALLOWED_HOSTS, ...LOCAL_HOSTS],
  }))
  .refine((env) => env.NODE_ENV !== "production" || env.ALLOWED_HOSTS.length > 0, {
    message: "ALLOWED_HOSTS must be set when NODE_ENV=production",
    path: ["ALLOWED_HOSTS"],
  });

export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule. Throws with every problem listed, which stops startup. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

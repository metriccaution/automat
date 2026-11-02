import type { MiddlewareHandler } from "hono";

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");

/**
 * The hostname from a `Host` header, without the port.
 */
export function hostname(host: string): string {
  const trimmed = host.trim().toLowerCase();
  if (trimmed.startsWith("[")) {
    return trimmed.slice(0, trimmed.indexOf("]") + 1);
  }
  return trimmed.replace(/:\d+$/, "");
}

/**
 * Only answer requests addressed to an allowed host (defeats DNS rebinding),
 * and only accept state changes from pages on an allowed host.
 */
export function hostChecks(allowedHosts: string[]): MiddlewareHandler {
  const allowed = new Set(allowedHosts.map((h) => h.toLowerCase()));

  return async (c, next) => {
    const host = hostname(c.req.header("Host") ?? "");
    if (!allowed.has(host)) {
      return c.text(
        `Host \`${host}\` is not in ALLOWED_HOSTS. Add it to the ALLOWED_HOSTS environment variable to use Automat at this address.`,
        421,
      );
    }

    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
      const origin = c.req.header("Origin");
      if (origin !== undefined && origin !== "null") {
        let ok = false;
        try {
          const url = new URL(origin);
          ok =
            (url.protocol === "http:" || url.protocol === "https:") &&
            allowed.has(hostname(url.host));
        } catch {
          ok = false;
        }
        if (!ok) {
          return c.text(`Requests from ${origin} aren't allowed`, 403);
        }
      } else if (origin === "null") {
        return c.text("Requests from an opaque origin aren't allowed", 403);
      }
    }

    await next();
  };
}

/**
 * Security headers on every response.
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "same-origin");
};

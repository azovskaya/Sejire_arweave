/**
 * Admin bearer token. Timing-safe compare; empty token means admin is off.
 */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export function readAdminToken(env: { ADMIN_TOKEN?: string }): string {
  return (env.ADMIN_TOKEN || "").trim();
}

export function adminConfigured(env: { ADMIN_TOKEN?: string }): boolean {
  return readAdminToken(env).length >= 16;
}

export function authorizeAdmin(
  request: Request,
  env: { ADMIN_TOKEN?: string }
): "ok" | "off" | "unauthorized" {
  if (!adminConfigured(env)) return "off";
  const hdr = request.headers.get("Authorization") || "";
  const got = hdr.toLowerCase().startsWith("bearer ") ? hdr.slice(7).trim() : "";
  const cookie = cookieToken(request);
  const token = got || cookie;
  return timingSafeEqual(token, readAdminToken(env)) ? "ok" : "unauthorized";
}

function cookieToken(request: Request): string {
  const raw = request.headers.get("Cookie") || "";
  const m = /(?:^|;\s*)sejire_admin=([^;]+)/.exec(raw);
  return m ? decodeURIComponent(m[1]) : "";
}

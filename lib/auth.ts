/**
 * Single-user auth gate — one password from an environment variable,
 * protecting every route (proxy.ts). No accounts, no registration, no
 * recovery flow (AGENTS.md "Single user. Do not build user management,
 * registration, or account recovery.") — this is the minimum that still
 * counts as a real gate: a session cookie whose value can only have been
 * produced by someone who knows AUTH_PASSWORD.
 *
 * The cookie holds SHA-256(password), not the password itself — mild
 * defense in depth (nothing plaintext-recoverable sits in browser storage)
 * — and comparisons are constant-time so response timing can't leak
 * information about how much of the token matched.
 *
 * Uses Node's `crypto` directly rather than Web Crypto: proxy.ts defaults
 * to the Node.js runtime as of Next.js 16 (previously Edge-only), so
 * there's no Edge-compatibility constraint to work around here.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE_NAME = "arc_auth";

export function computeAuthToken(password: string): string {
  return createHash("sha256").update(password, "utf8").digest("hex");
}

/** Constant-time. Also correct (not just safe) when either input is empty or malformed — never throws. */
export function isValidAuthToken(token: string | undefined | null, password: string): boolean {
  if (!token) return false;
  const expected = computeAuthToken(password);
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

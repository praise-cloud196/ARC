/**
 * Single-user auth gate (AGENTS.md "Single user. Do not build user
 * management, registration, or account recovery.") — protects every route
 * except /login itself and the two things that have their own separate
 * auth already: /api/cron/* (Vercel's bearer-token CRON_SECRET) and static
 * assets the PWA needs reachable unauthenticated (the manifest, icon, and
 * service worker file itself — blocking sw.js behind a login redirect
 * would break installability, since the browser would register the login
 * page's HTML as the "service worker").
 *
 * `proxy.ts`, not `middleware.ts`: the latter is deprecated as of Next.js
 * 16, renamed to Proxy — same mechanism, new file/export name. Runs on the
 * Node.js runtime by default (also new in 16), which is why lib/auth.ts
 * can use Node's `crypto` directly instead of Web Crypto.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, isValidAuthToken } from "./lib/auth";

export function proxy(request: NextRequest): NextResponse {
  const password = process.env.AUTH_PASSWORD;
  if (!password) {
    // Fail closed: a missing password must never silently disable the gate.
    return new NextResponse("AUTH_PASSWORD is not configured.", { status: 500 });
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (isValidAuthToken(token, password)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|api/cron|_next/static|_next/image|favicon.ico|manifest.json|icon.svg|sw.js).*)"],
};

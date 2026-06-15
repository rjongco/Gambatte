import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, authConfig, verifySessionToken } from "@/lib/auth";

// Login gate for the whole app. There is no user system — a single
// username/password lives in .env (BASIC_AUTH_USER / BASIC_AUTH_PASSWORD). A
// successful login at /login sets a signed, 7-day session cookie; this proxy
// checks that cookie and otherwise sends visitors to /login (or 401s the API).
//
// In Next.js 16 the old `middleware.ts` is named `proxy.ts` and runs on the
// Node.js runtime, so it can share lib/auth.ts (node:crypto) with the API routes.

export function proxy(request: NextRequest): Response | undefined {
  const cfg = authConfig();
  // Gate disabled when credentials aren't configured (e.g. local dev).
  if (!cfg.enabled) return undefined;

  const { pathname } = request.nextUrl;
  const authed = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, cfg);

  // The login page and its endpoints must stay reachable while logged out.
  const isLoginRoute = pathname === "/login" || pathname.startsWith("/api/auth/");
  if (isLoginRoute) {
    // Already signed in? Skip the login page.
    if (authed && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return undefined;
  }

  if (authed) return undefined;

  // Unauthenticated: API callers get a clean 401; page loads go to /login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const url = new URL("/login", request.url);
  url.searchParams.set("from", pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // Run on every request EXCEPT Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

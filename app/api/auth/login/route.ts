import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  authConfig,
  createSessionToken,
  safeEqual,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const Body = z.object({ username: z.string(), password: z.string() });

export async function POST(req: NextRequest) {
  const cfg = authConfig();
  // Gate disabled: nothing to log into.
  if (!cfg.enabled) {
    return NextResponse.json({ error: "Login is not enabled" }, { status: 400 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { username, password } = parsed.data;
  // Evaluate both halves to avoid leaking which field was wrong via timing.
  const ok = safeEqual(username, cfg.user) && safeEqual(password, cfg.password);
  if (!ok) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(cfg), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    // Only require HTTPS when the request itself came over HTTPS, so the cookie
    // still works on a plain-HTTP LAN deployment.
    secure: req.nextUrl.protocol === "https:",
  });
  return res;
}

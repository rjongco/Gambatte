import { createHmac, timingSafeEqual } from "node:crypto";

// Cookie-based session for the single-user login gate. There is no user table:
// one username/password lives in .env, and a successful login mints a signed,
// time-limited token stored in an HttpOnly cookie. The signature is an HMAC keyed
// by AUTH_SECRET (falling back to the password), so the cookie can't be forged and
// changing the password/secret invalidates every existing session.

export const SESSION_COOKIE = "gambatte_session";
export const SESSION_DAYS = 7;
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60; // seconds

interface AuthConfig {
  enabled: boolean;
  user: string;
  password: string;
  secret: string;
}

/** Read the gate's configuration. Disabled (open) unless both creds are set. */
export function authConfig(): AuthConfig {
  const user = process.env.BASIC_AUTH_USER ?? "";
  const password = process.env.BASIC_AUTH_PASSWORD ?? "";
  // Sign with AUTH_SECRET if provided, else derive from the password so there's
  // no extra mandatory env var (rotating the password also logs everyone out).
  const secret = process.env.AUTH_SECRET || `gambatte:${password}`;
  return { enabled: Boolean(user && password), user, password, secret };
}

/** Constant-time string compare (length-independent early exit only). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Mint a session token valid for SESSION_DAYS, bound to the username. */
export function createSessionToken(cfg: AuthConfig, now = Date.now()): string {
  const exp = now + SESSION_MAX_AGE * 1000;
  const payload = `${cfg.user}.${exp}`;
  return `${payload}.${sign(payload, cfg.secret)}`;
}

/** True if the token is well-formed, correctly signed, for this user, and unexpired. */
export function verifySessionToken(
  token: string | undefined,
  cfg: AuthConfig,
  now = Date.now(),
): boolean {
  if (!token) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!safeEqual(sig, sign(payload, cfg.secret))) return false;

  const firstDot = payload.indexOf(".");
  const user = payload.slice(0, firstDot);
  const exp = Number(payload.slice(firstDot + 1));
  if (!safeEqual(user, cfg.user)) return false;
  return Number.isFinite(exp) && now < exp;
}

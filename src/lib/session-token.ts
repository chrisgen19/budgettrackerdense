/**
 * The session cookie's format: a compact HS256 JWT holding only the user id.
 *
 * Deliberately not NextAuth. budgettracker owns its own NextAuth secret and
 * cookie; sharing either across two deploys would couple the apps. Nothing but
 * `sub`, `iat` and `exp` is stored, so every request re-loads the user and
 * re-checks the allowlist (`src/server/session.ts`): revoking access is then a
 * change to `ALLOWED_EMAILS`, not a wait for a cookie to expire.
 *
 * This module stays free of `next/headers`, Prisma and `server-only` so
 * `src/proxy.ts` can verify a cookie with the same code the pages use.
 */
import { SignJWT, jwtVerify } from "jose";

/** Cookie name. Prefixed so it cannot collide with budgettracker's cookies. */
export const SESSION_COOKIE = "dense_session";

/** 12 hours, as decided in docs/plans/04-auth.md. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

/**
 * How long a token is used before activity re-issues it. The window slides, but
 * at most once an hour, so a busy session does not re-sign on every request.
 */
export const SESSION_REFRESH_AFTER_SECONDS = 60 * 60;

const ALGORITHM = "HS256";

/** 32 bytes of entropy, base64, is the documented minimum for `SESSION_SECRET`. */
const MIN_SECRET_LENGTH = 32;

/** What a verified cookie carries. Seconds, matching the JWT claims. */
export interface SessionPayload {
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

/** Reads and validates `SESSION_SECRET`. Throws loudly rather than signing weakly. */
export function sessionSecret(raw: string | undefined = process.env.SESSION_SECRET): Uint8Array {
  if (!raw || raw.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters (32 random bytes, base64).`,
    );
  }

  return new TextEncoder().encode(raw);
}

/** Signs a session for `userId`, valid for `SESSION_TTL_SECONDS` from `nowMs`. */
export async function signSession(
  userId: string,
  secret: Uint8Array,
  nowMs: number = Date.now(),
): Promise<string> {
  const issuedAt = Math.floor(nowMs / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_TTL_SECONDS)
    .sign(secret);
}

/**
 * Verifies a cookie value. Returns `null` for anything not currently valid:
 * a bad signature, a tampered payload, an expired token, a different algorithm,
 * or claims of the wrong shape. Callers never see why, by design.
 */
export async function verifySession(
  token: string,
  secret: Uint8Array,
  nowMs: number = Date.now(),
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALGORITHM],
      currentDate: new Date(nowMs),
    });

    const { sub, iat, exp } = payload;
    if (typeof sub !== "string" || sub.length === 0) return null;
    if (typeof iat !== "number" || typeof exp !== "number") return null;

    return { userId: sub, issuedAt: iat, expiresAt: exp };
  } catch {
    return null;
  }
}

/** Whether this token has been in use long enough to be re-issued. */
export function shouldRefreshSession(
  session: SessionPayload,
  nowMs: number = Date.now(),
): boolean {
  return Math.floor(nowMs / 1000) - session.issuedAt >= SESSION_REFRESH_AFTER_SECONDS;
}

/** Cookie attributes shared by the server action that signs in and the proxy that slides. */
export function sessionCookieOptions(isProduction = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true,
    // Off locally: `pnpm dev` serves plain http on 127.0.0.1 and a Secure
    // cookie would never be stored there.
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

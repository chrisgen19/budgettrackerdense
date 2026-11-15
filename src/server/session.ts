import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isEmailAllowedByEnv } from "@/lib/allowlist";
import {
  SESSION_COOKIE,
  type SessionPayload,
  sessionCookieOptions,
  sessionSecret,
  signSession,
  verifySession,
} from "@/lib/session-token";
import { prisma } from "@/server/db";

/**
 * The session, from the cookie to the user row.
 *
 * The cookie holds only a user id (`src/lib/session-token.ts`). Everything else
 * is re-read per request: the user has to still exist, still be verified and
 * still be on `ALLOWED_EMAILS`, so removing an address logs that person out on
 * their next request instead of at the end of their 12 hours.
 */

/** The fields every page needs. `timezoneOffset` is `Date.getTimezoneOffset()` minutes. */
export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  currency: string;
  timezoneOffset: number;
}

/** Signs a fresh session for `userId` and sets the cookie. Server actions only. */
export async function createSession(userId: string): Promise<void> {
  const token = await signSession(userId, sessionSecret());
  const store = await cookies();

  store.set({ name: SESSION_COOKIE, value: token, ...sessionCookieOptions() });
}

/** The verified cookie payload, or `null` when there is no valid session. */
export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  return verifySession(token, sessionSecret());
}

/** Clears the cookie. Server actions and route handlers only. */
export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * The signed-in user, or `null`. Every page and every server action starts here;
 * `src/proxy.ts` checking the signature is an optimistic gate, not this check.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      currency: true,
      timezoneOffset: true,
      emailVerified: true,
    },
  });

  if (!user || !user.emailVerified) return null;
  if (!isEmailAllowedByEnv(user.email)) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    currency: user.currency,
    timezoneOffset: user.timezoneOffset,
  };
}

/** `getCurrentUser()` for pages: redirects to `/login` instead of returning `null`. */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return user;
}

/**
 * `getCurrentUser()` for server actions and route handlers, where a redirect
 * would be swallowed by the caller's fetch. Throws instead.
 */
export async function requireCurrentUserOrThrow(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");

  return user;
}

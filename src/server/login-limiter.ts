import "server-only";
import { createRateLimiter } from "@/lib/rate-limit";

/** Failed logins allowed per IP and email pair inside the window. */
export const LOGIN_FAILURE_LIMIT = 5;

/** The window, 15 minutes. */
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;

/**
 * Process-wide limiter for the login action. Module scope on purpose: one
 * instance per container, shared by every request it serves. See
 * `src/lib/rate-limit.ts` on why a second replica would need a shared store.
 */
export const loginLimiter = createRateLimiter({
  limit: LOGIN_FAILURE_LIMIT,
  windowMs: LOGIN_FAILURE_WINDOW_MS,
});

/** The limiter key: the client address and the submitted email together. */
export function loginLimiterKey(ip: string, email: string): string {
  return `${ip}|${email}`;
}

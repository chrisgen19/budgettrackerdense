import "server-only";
import { createRateLimiter } from "@/lib/rate-limit";

/** Failed logins allowed per IP and email pair inside the window. */
export const LOGIN_FAILURE_LIMIT = 5;

/**
 * Failed logins allowed per IP across every email inside the window. Stops one
 * address cycling through made-up emails to dodge the per-pair limit.
 */
export const LOGIN_IP_FAILURE_LIMIT = 20;

/** The window, 15 minutes. */
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;

/**
 * Process-wide limiters for the login action. Module scope on purpose: one
 * instance per container, shared by every request it serves. See
 * `src/lib/rate-limit.ts` on why a second replica would need a shared store.
 */
export const loginLimiter = createRateLimiter({
  limit: LOGIN_FAILURE_LIMIT,
  windowMs: LOGIN_FAILURE_WINDOW_MS,
});

export const loginIpLimiter = createRateLimiter({
  limit: LOGIN_IP_FAILURE_LIMIT,
  windowMs: LOGIN_FAILURE_WINDOW_MS,
});

/** The limiter key: the client address and the submitted email together. */
export function loginLimiterKey(ip: string, email: string): string {
  return `${ip}|${email}`;
}

/** Whether this attempt is refused before the password is checked. */
export function isLoginBlocked(ip: string, email: string, nowMs = Date.now()): boolean {
  return loginIpLimiter.isBlocked(ip, nowMs) || loginLimiter.isBlocked(loginLimiterKey(ip, email), nowMs);
}

/** Counts one failed login against both the pair and the address. */
export function recordLoginFailure(ip: string, email: string, nowMs = Date.now()): void {
  loginLimiter.recordFailure(loginLimiterKey(ip, email), nowMs);
  loginIpLimiter.recordFailure(ip, nowMs);
}

/**
 * Clears the pair after a success. The address count stays: one good login
 * should not wipe failures it made against other emails.
 */
export function clearLoginFailures(ip: string, email: string): void {
  loginLimiter.clear(loginLimiterKey(ip, email));
}

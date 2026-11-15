/**
 * A sliding-window counter, in memory.
 *
 * Used for failed logins only. One Coolify container runs this app, so process
 * memory is enough; a second replica would need a shared store (Redis, or a
 * table) because each replica would keep its own count and multiply the limit.
 */
export interface RateLimiterOptions {
  /** Failures allowed inside the window before the key is blocked. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Keys kept before stale ones are swept. Guards against unbounded growth. */
  maxKeys?: number;
}

export interface RateLimiter {
  /** Whether `key` has already used up its failures inside the window. */
  isBlocked(key: string, nowMs?: number): boolean;
  /** Records one failure for `key`. */
  recordFailure(key: string, nowMs?: number): void;
  /** Forgets `key`, so a success clears the count. */
  clear(key: string): void;
  /** Forgets everything. Tests use this; the app does not. */
  reset(): void;
}

const DEFAULT_MAX_KEYS = 500;

/** Builds a limiter. Every method takes `nowMs` so the window is testable. */
export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = DEFAULT_MAX_KEYS,
}: RateLimiterOptions): RateLimiter {
  const failures = new Map<string, number[]>();

  const recent = (key: string, nowMs: number): number[] => {
    const cutoff = nowMs - windowMs;
    const kept = (failures.get(key) ?? []).filter((at) => at > cutoff);

    if (kept.length === 0) failures.delete(key);
    else failures.set(key, kept);

    return kept;
  };

  const sweep = (nowMs: number): void => {
    for (const key of [...failures.keys()]) recent(key, nowMs);
  };

  return {
    isBlocked(key, nowMs = Date.now()) {
      return recent(key, nowMs).length >= limit;
    },

    recordFailure(key, nowMs = Date.now()) {
      if (failures.size > maxKeys) sweep(nowMs);
      failures.set(key, [...recent(key, nowMs), nowMs]);
    },

    clear(key) {
      failures.delete(key);
    },

    reset() {
      failures.clear();
    },
  };
}

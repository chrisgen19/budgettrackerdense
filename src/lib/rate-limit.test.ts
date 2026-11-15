import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

const WINDOW_MS = 15 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 15, 8, 0, 0);

const limiter = () => createRateLimiter({ limit: 5, windowMs: WINDOW_MS });

describe("createRateLimiter", () => {
  it("allows the first five failures and blocks the sixth attempt", () => {
    const rateLimiter = limiter();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(rateLimiter.isBlocked("key", NOW + attempt)).toBe(false);
      rateLimiter.recordFailure("key", NOW + attempt);
    }

    expect(rateLimiter.isBlocked("key", NOW + 5)).toBe(true);
  });

  it("keeps separate counts per key", () => {
    const rateLimiter = limiter();

    for (let attempt = 0; attempt < 5; attempt += 1) rateLimiter.recordFailure("a", NOW);

    expect(rateLimiter.isBlocked("a", NOW)).toBe(true);
    expect(rateLimiter.isBlocked("b", NOW)).toBe(false);
  });

  it("slides: failures leave the window one by one", () => {
    const rateLimiter = limiter();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      rateLimiter.recordFailure("key", NOW + attempt * 60_000);
    }

    // Still blocked while the window still holds all five.
    expect(rateLimiter.isBlocked("key", NOW + WINDOW_MS - 1)).toBe(true);

    // A full window after the oldest, it has aged out and there is room for one more.
    expect(rateLimiter.isBlocked("key", NOW + WINDOW_MS)).toBe(false);

    // And after a full window past the newest, nothing is counted.
    expect(rateLimiter.isBlocked("key", NOW + 4 * 60_000 + WINDOW_MS)).toBe(false);
  });

  it("forgets a key on success", () => {
    const rateLimiter = limiter();

    for (let attempt = 0; attempt < 5; attempt += 1) rateLimiter.recordFailure("key", NOW);
    rateLimiter.clear("key");

    expect(rateLimiter.isBlocked("key", NOW)).toBe(false);
  });

  it("sweeps stale keys instead of growing forever", () => {
    const rateLimiter = createRateLimiter({ limit: 5, windowMs: WINDOW_MS, maxKeys: 10 });

    for (let key = 0; key < 20; key += 1) rateLimiter.recordFailure(`key-${key}`, NOW);
    // Every earlier key is outside the window by now, so this one triggers a sweep.
    rateLimiter.recordFailure("fresh", NOW + WINDOW_MS + 1);

    expect(rateLimiter.isBlocked("key-0", NOW + WINDOW_MS + 1)).toBe(false);
    expect(rateLimiter.isBlocked("fresh", NOW + WINDOW_MS + 1)).toBe(false);
  });

  it("reset clears everything", () => {
    const rateLimiter = limiter();

    for (let attempt = 0; attempt < 5; attempt += 1) rateLimiter.recordFailure("key", NOW);
    rateLimiter.reset();

    expect(rateLimiter.isBlocked("key", NOW)).toBe(false);
  });
});

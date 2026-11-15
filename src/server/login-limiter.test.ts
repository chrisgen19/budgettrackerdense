import { beforeEach, describe, expect, it } from "vitest";
import {
  LOGIN_FAILURE_LIMIT,
  LOGIN_IP_FAILURE_LIMIT,
  clearLoginFailures,
  isLoginBlocked,
  loginIpLimiter,
  loginLimiter,
  recordLoginFailure,
} from "./login-limiter";

const NOW = Date.UTC(2026, 10, 15, 8, 0, 0);
const IP = "203.0.113.7";

describe("login limiter", () => {
  beforeEach(() => {
    loginLimiter.reset();
    loginIpLimiter.reset();
  });

  it("blocks an IP and email pair after its own limit", () => {
    for (let n = 0; n < LOGIN_FAILURE_LIMIT; n += 1) recordLoginFailure(IP, "me@example.com", NOW);

    expect(isLoginBlocked(IP, "me@example.com", NOW)).toBe(true);
    expect(isLoginBlocked(IP, "other@example.com", NOW)).toBe(false);
  });

  it("blocks an IP that cycles through made-up emails", () => {
    for (let n = 0; n < LOGIN_IP_FAILURE_LIMIT; n += 1) {
      recordLoginFailure(IP, `guess-${n}@example.com`, NOW);
    }

    expect(isLoginBlocked(IP, "brand-new@example.com", NOW)).toBe(true);
    expect(isLoginBlocked("198.51.100.1", "brand-new@example.com", NOW)).toBe(false);
  });

  it("clears only the pair on success, keeping the address count", () => {
    for (let n = 0; n < LOGIN_IP_FAILURE_LIMIT - 1; n += 1) {
      recordLoginFailure(IP, `guess-${n}@example.com`, NOW);
    }
    recordLoginFailure(IP, "me@example.com", NOW);
    clearLoginFailures(IP, "me@example.com");

    expect(isLoginBlocked(IP, "me@example.com", NOW)).toBe(true);
  });
});

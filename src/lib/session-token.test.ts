import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import {
  SESSION_REFRESH_AFTER_SECONDS,
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
  sessionSecret,
  shouldRefreshSession,
  signSession,
  verifySession,
} from "./session-token";

const SECRET = sessionSecret("0123456789abcdef0123456789abcdef");
const OTHER_SECRET = sessionSecret("fedcba9876543210fedcba9876543210");
const NOW = Date.UTC(2026, 10, 15, 8, 0, 0);

describe("sessionSecret", () => {
  it("refuses a missing or short secret", () => {
    expect(() => sessionSecret(undefined)).toThrow(/SESSION_SECRET/);
    expect(() => sessionSecret("")).toThrow(/SESSION_SECRET/);
    expect(() => sessionSecret("too-short")).toThrow(/at least 32/);
  });
});

describe("signSession and verifySession", () => {
  it("round-trips the user id with a 12-hour lifetime", async () => {
    const token = await signSession("user_1", SECRET, NOW);
    const session = await verifySession(token, SECRET, NOW);

    expect(session).toEqual({
      userId: "user_1",
      issuedAt: Math.floor(NOW / 1000),
      expiresAt: Math.floor(NOW / 1000) + SESSION_TTL_SECONDS,
    });
    expect(SESSION_TTL_SECONDS).toBe(12 * 60 * 60);
  });

  it("rejects the token one second after it expires", async () => {
    const token = await signSession("user_1", SECRET, NOW);

    const justInside = NOW + (SESSION_TTL_SECONDS - 1) * 1000;
    expect(await verifySession(token, SECRET, justInside)).not.toBeNull();

    const justOutside = NOW + (SESSION_TTL_SECONDS + 1) * 1000;
    expect(await verifySession(token, SECRET, justOutside)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signSession("user_1", OTHER_SECRET, NOW);
    expect(await verifySession(token, SECRET, NOW)).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await signSession("user_1", SECRET, NOW);
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "user_2", iat: Math.floor(NOW / 1000), exp: 9_999_999_999 }),
    ).toString("base64url");

    expect(await verifySession(`${header}.${forgedPayload}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("rejects a token with no signature at all", async () => {
    const unsecured = await new SignJWT({ sub: "user_1" })
      .setProtectedHeader({ alg: "none" })
      .sign(new Uint8Array(0))
      .catch(() => "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyXzEifQ.");

    expect(await verifySession(unsecured, SECRET, NOW)).toBeNull();
  });

  it("rejects a correctly signed token whose claims are the wrong shape", async () => {
    const noSubject = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(NOW / 1000))
      .setExpirationTime(Math.floor(NOW / 1000) + 60)
      .sign(SECRET);

    expect(await verifySession(noSubject, SECRET, NOW)).toBeNull();
  });

  it("rejects junk", async () => {
    expect(await verifySession("", SECRET, NOW)).toBeNull();
    expect(await verifySession("not-a-jwt", SECRET, NOW)).toBeNull();
  });
});

describe("shouldRefreshSession", () => {
  const session = {
    userId: "user_1",
    issuedAt: Math.floor(NOW / 1000),
    expiresAt: Math.floor(NOW / 1000) + SESSION_TTL_SECONDS,
  };

  it("leaves a fresh token alone", () => {
    expect(shouldRefreshSession(session, NOW)).toBe(false);
    expect(shouldRefreshSession(session, NOW + (SESSION_REFRESH_AFTER_SECONDS - 1) * 1000)).toBe(
      false,
    );
  });

  it("re-issues once the token has been in use for an hour", () => {
    expect(shouldRefreshSession(session, NOW + SESSION_REFRESH_AFTER_SECONDS * 1000)).toBe(true);
  });
});

describe("sessionCookieOptions", () => {
  it("is httpOnly, lax and site-wide, and Secure only in production", () => {
    expect(sessionCookieOptions(true)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    expect(sessionCookieOptions(false).secure).toBe(false);
  });
});

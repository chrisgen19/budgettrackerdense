import { describe, expect, it } from "vitest";
import { clientIpFrom } from "./client-ip";

describe("clientIpFrom", () => {
  it("takes the first x-forwarded-for hop", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2" });
    expect(clientIpFrom(headers)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("ignores an empty x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": " ", "x-real-ip": "203.0.113.9" });
    expect(clientIpFrom(headers)).toBe("203.0.113.9");
  });

  it("returns unknown when neither header is present", () => {
    expect(clientIpFrom(new Headers())).toBe("unknown");
  });
});

import { describe, expect, it } from "vitest";
import { currentMonthKey } from "./month";

describe("currentMonthKey", () => {
  const MANILA = -480;

  it("uses the user's local month, not UTC's", () => {
    // 30 Sep 2026 17:30 UTC is already 1 Oct in Manila.
    const instant = new Date(Date.UTC(2026, 8, 30, 17, 30));

    expect(currentMonthKey(MANILA, instant)).toBe("2026-10");
    expect(currentMonthKey(0, instant)).toBe("2026-09");
  });

  it("pads single-digit months", () => {
    expect(currentMonthKey(MANILA, new Date(Date.UTC(2026, 0, 15)))).toBe("2026-01");
  });

  it("rolls the year over in local time", () => {
    // 31 Dec 2026 16:00 UTC is 1 Jan 2027 in Manila.
    expect(currentMonthKey(MANILA, new Date(Date.UTC(2026, 11, 31, 16)))).toBe("2027-01");
  });
});

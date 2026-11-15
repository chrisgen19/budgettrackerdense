import { describe, expect, it } from "vitest";
import { userToday, utcDayKey } from "@bt/lib/bill-dates";
import {
  billsHref,
  daysBetween,
  describeDaysUntil,
  describeEstimateBasis,
  describeLateness,
  describeReminder,
  formatDayKey,
  parseDays,
  parseHistory,
} from "./bills";

describe("bill dates are calendar days", () => {
  it("formats the stored day literally, whatever the offset", () => {
    // A due date of the 5th is the 5th for everyone. Shifting it by -480 (or by
    // any zone west of UTC) would print the 4th and make an on-time payment late.
    expect(formatDayKey("2026-10-05")).toBe("Oct 5, 2026");
  });

  it("counts whole days between two keys, negative when overdue", () => {
    expect(daysBetween("2026-11-15", "2026-10-05")).toBe(-41);
    expect(daysBetween("2026-11-15", "2026-11-15")).toBe(0);
    expect(daysBetween("2026-11-15", "2026-12-01")).toBe(16);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
  });

  it("refuses anything that is not a day key", () => {
    expect(() => daysBetween("2026-11-15T00:00:00Z", "2026-10-05")).toThrow(RangeError);
  });

  it("takes today from the user's offset, not UTC's", () => {
    // 20:00 UTC on the 14th is 04:00 on the 15th in Manila (-480).
    const now = new Date("2026-11-14T20:00:00Z");
    expect(utcDayKey(userToday(-480, now))).toBe("2026-11-15");
    expect(utcDayKey(userToday(0, now))).toBe("2026-11-14");
  });
});

describe("descriptions", () => {
  it("says how far off a due day is", () => {
    expect(describeDaysUntil(-41)).toBe("41 days overdue");
    expect(describeDaysUntil(-1)).toBe("1 day overdue");
    expect(describeDaysUntil(0)).toBe("today");
    expect(describeDaysUntil(1)).toBe("tomorrow");
    expect(describeDaysUntil(9)).toBe("in 9 days");
  });

  it("names the reminder, with 0 as the due day itself", () => {
    expect(describeReminder(0)).toBe("on the day");
    expect(describeReminder(1)).toBe("1 day before");
    expect(describeReminder(3)).toBe("3 days before");
  });

  it("keeps early payments early rather than clamping them to on time", () => {
    expect(describeLateness(null)).toBe("");
    expect(describeLateness(0)).toBe("on time");
    expect(describeLateness(2)).toBe("2 days late");
    expect(describeLateness(-1)).toBe("1 day early");
  });

  it("says where an estimate came from", () => {
    expect(describeEstimateBasis(null)).toBe("fixed");
    expect(describeEstimateBasis("same-month-last-year")).toBe("same month last year");
    expect(describeEstimateBasis("last-payment")).toBe("last payment");
  });
});

describe("URL parameters", () => {
  it("accepts only the offered windows", () => {
    expect(parseDays("7")).toBe(7);
    expect(parseDays(["14", "7"])).toBe(14);
    expect(parseDays("8")).toBe(30);
    expect(parseDays(undefined)).toBe(30);
    expect(parseHistory("12")).toBe(12);
    expect(parseHistory("abc")).toBe(6);
  });

  it("leaves defaults out of the link", () => {
    expect(billsHref(30, 6)).toBe("/bills");
    expect(billsHref(7, 6)).toBe("/bills?days=7");
    expect(billsHref(14, 12)).toBe("/bills?days=14&months=12");
  });
});

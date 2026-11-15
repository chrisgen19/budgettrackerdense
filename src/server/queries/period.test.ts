import { describe, expect, it } from "vitest";
import { localDayInstant, monthSpan, resolveWindow } from "./period";

/** Christian's offset: UTC+8 as `Date.getTimezoneOffset()` minutes. */
const MANILA = -480;

describe("localDayInstant", () => {
  it("starts a Manila day at 16:00 UTC the day before", () => {
    expect(localDayInstant("2026-09-01", MANILA).toISOString()).toBe("2026-08-31T16:00:00.000Z");
  });

  it("ends a Manila day at 15:59:59.999 UTC the same day", () => {
    expect(localDayInstant("2026-09-30", MANILA, true).toISOString()).toBe(
      "2026-09-30T15:59:59.999Z",
    );
  });

  it("falls back to UTC midnight when the offset is zero", () => {
    expect(localDayInstant("2026-09-01", 0).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("rejects anything that is not YYYY-MM-DD", () => {
    expect(() => localDayInstant("2026-9-1", MANILA)).toThrow(RangeError);
  });
});

describe("resolveWindow", () => {
  it("covers a whole Manila month, both bounds inclusive", () => {
    const window = resolveWindow({ month: "2026-09" }, MANILA);

    expect(window.startDate?.toISOString()).toBe("2026-08-31T16:00:00.000Z");
    expect(window.endDate?.toISOString()).toBe("2026-09-30T15:59:59.999Z");
    expect(window.period.from).toBe("2026-09-01");
    expect(window.period.to).toBe("2026-09-30");
  });

  it("includes the whole of an explicit last day", () => {
    const window = resolveWindow({ from: "2026-09-10", to: "2026-09-12" }, MANILA);

    expect(window.startDate?.toISOString()).toBe("2026-09-09T16:00:00.000Z");
    expect(window.endDate?.toISOString()).toBe("2026-09-12T15:59:59.999Z");
    expect(window.period.daysInPeriod).toBe(3);
  });

  it("returns the same month for a different offset at different instants", () => {
    const manila = resolveWindow({ month: "2026-09" }, MANILA);
    const utc = resolveWindow({ month: "2026-09" }, 0);

    expect(manila.period.from).toBe(utc.period.from);
    expect(manila.startDate?.getTime()).not.toBe(utc.startDate?.getTime());
  });

  it("leaves a bound open rather than substituting a sentinel instant", () => {
    const window = resolveWindow({ from: "2026-09-01" }, MANILA, false);

    expect(window.endDate).toBeNull();
    expect(window.dateFilter.lte).toBeUndefined();
    expect(window.dateFilter.gte?.toISOString()).toBe("2026-08-31T16:00:00.000Z");
  });

  it("filters nothing when no period is given and no fallback is wanted", () => {
    const window = resolveWindow({}, MANILA, false);

    expect(window.dateFilter).toEqual({});
    expect(window.period.month).toBeNull();
  });

  it("falls back to a month, not to all time, when asked to", () => {
    expect(resolveWindow({}, MANILA).period.month).toMatch(/^\d{4}-\d{2}$/);
  });

  it("refuses a month and a range together, as the shared queries do", () => {
    expect(() => resolveWindow({ month: "2026-09", from: "2026-09-10" }, MANILA)).toThrow(
      RangeError,
    );
  });
});

describe("monthSpan", () => {
  it("ends at the month asked for, oldest first", () => {
    expect(monthSpan("2026-09", 6)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });

  it("crosses a year boundary", () => {
    expect(monthSpan("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("rejects a span of no months", () => {
    expect(() => monthSpan("2026-09", 0)).toThrow(RangeError);
  });
});

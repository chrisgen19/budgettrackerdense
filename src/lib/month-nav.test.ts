import { describe, expect, it } from "vitest";
import { monthLabel, monthShort, parseMonth } from "./month-nav";

describe("parseMonth", () => {
  it("accepts a well-formed month", () => {
    expect(parseMonth("2026-09")).toBe("2026-09");
    expect(parseMonth(" 2026-01 ")).toBe("2026-01");
    expect(parseMonth("2026-12")).toBe("2026-12");
  });

  it("takes the first value when the parameter repeats", () => {
    expect(parseMonth(["2026-09", "2026-10"])).toBe("2026-09");
  });

  it("refuses anything that is not a month, rather than erroring", () => {
    expect(parseMonth(undefined)).toBeNull();
    expect(parseMonth("")).toBeNull();
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth("2026-00")).toBeNull();
    expect(parseMonth("2026-9")).toBeNull();
    expect(parseMonth("September")).toBeNull();
    expect(parseMonth("1999-12")).toBeNull();
  });
});

describe("monthLabel and monthShort", () => {
  it("read the key literally, with no timezone shift", () => {
    expect(monthLabel("2026-09")).toBe("September 2026");
    expect(monthLabel("2026-01")).toBe("January 2026");
    expect(monthShort("2026-09")).toBe("Sep");
  });
});

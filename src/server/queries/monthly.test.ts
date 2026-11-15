import { describe, expect, it } from "vitest";
import type { MonthSummary } from "@bt/lib/budget-query-types";
import { isEmptyMonth, monthsApart, monthsEndingAt } from "./monthly";

/** A summary row with only the fields these helpers read. */
const row = (monthKey: string): MonthSummary =>
  ({ monthKey, month: monthKey, income: 0, expenses: 0, net: 0 }) as MonthSummary;

describe("monthsApart", () => {
  it("counts whole months forward", () => {
    expect(monthsApart("2026-09", "2026-11")).toBe(2);
    expect(monthsApart("2026-11", "2026-11")).toBe(0);
    expect(monthsApart("2025-11", "2026-02")).toBe(3);
  });

  it("never goes negative, so a future month asks for no extra history", () => {
    expect(monthsApart("2027-01", "2026-11")).toBe(0);
  });
});

describe("monthsEndingAt", () => {
  const summary = [
    "2026-04",
    "2026-05",
    "2026-06",
    "2026-07",
    "2026-08",
    "2026-09",
    "2026-10",
    "2026-11",
  ].map(row);

  it("takes the six months ending at the month being viewed", () => {
    expect(monthsEndingAt(summary, "2026-09", 6).map((m) => m.monthKey)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });

  it("ends at the current month when that is the one being viewed", () => {
    expect(monthsEndingAt(summary, "2026-11", 6).map((m) => m.monthKey)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
  });

  it("returns a short window rather than padding when history runs out", () => {
    expect(monthsEndingAt(summary, "2026-06", 6).map((m) => m.monthKey)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
    ]);
  });

  it("falls back to the newest six when the month is not in the summary", () => {
    expect(monthsEndingAt(summary, "2030-01", 6).map((m) => m.monthKey)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
  });
});

describe("isEmptyMonth", () => {
  it("is true only when nothing at all was logged", () => {
    expect(isEmptyMonth(row("2026-10"))).toBe(true);
    expect(isEmptyMonth({ ...row("2026-09"), expenses: 81_578.35 })).toBe(false);
    expect(isEmptyMonth({ ...row("2026-09"), income: 79_953.66 })).toBe(false);
  });
});

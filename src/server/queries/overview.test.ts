import { describe, expect, it } from "vitest";
import type { MonthSummary } from "@bt/lib/budget-query-types";
import { monthsApart, sparkWindow } from "./overview";

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

describe("sparkWindow", () => {
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
    expect(sparkWindow(summary, "2026-09").map((m) => m.monthKey)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });

  it("ends at the current month when that is the one being viewed", () => {
    expect(sparkWindow(summary, "2026-11").map((m) => m.monthKey)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
  });

  it("returns a short window rather than padding when history runs out", () => {
    expect(sparkWindow(summary, "2026-06").map((m) => m.monthKey)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
    ]);
  });

  it("falls back to the newest six when the month is not in the summary", () => {
    expect(sparkWindow(summary, "2030-01").map((m) => m.monthKey)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
  });
});
